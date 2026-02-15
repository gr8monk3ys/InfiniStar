import { NextResponse, type NextRequest } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { z } from "zod"

import { verifyCsrfToken } from "@/app/lib/csrf"
import {
  buildModerationDetails,
  moderateTextModelAssisted,
  moderationReasonFromCategories,
} from "@/app/lib/moderation"
import prisma from "@/app/lib/prismadb"
import { pusherServer } from "@/app/lib/pusher"
import { getPusherConversationChannel, getPusherUserChannel } from "@/app/lib/pusher-channels"
import { apiLimiter, getClientIdentifier } from "@/app/lib/rate-limit"
import { sanitizeMessage, sanitizeUrl } from "@/app/lib/sanitize"

// Validation schema for creating messages
const createMessageSchema = z.object({
  message: z.string().max(5000, "Message too long (max 5000 characters)").optional(),
  image: z.string().url("Invalid image URL").max(2000, "Image URL too long").optional().nullable(),
  audioUrl: z
    .string()
    .url("Invalid audio URL")
    .max(2000, "Audio URL too long")
    .optional()
    .nullable(),
  audioTranscript: z
    .string()
    .max(10000, "Transcript too long (max 10000 characters)")
    .optional()
    .nullable(),
  conversationId: z.string().min(1, "Conversation ID is required"),
  replyToId: z.string().optional().nullable(),
})

export async function POST(request: NextRequest) {
  // CSRF Protection
  const headerToken = request.headers.get("X-CSRF-Token")
  const cookieHeader = request.headers.get("cookie")
  let cookieToken: string | null = null

  if (cookieHeader) {
    const cookies = cookieHeader.split(";").reduce(
      (acc, cookie) => {
        const [key, value] = cookie.trim().split("=")
        acc[key] = value
        return acc
      },
      {} as Record<string, string>
    )
    cookieToken = cookies["csrf-token"] || null
  }

  if (!verifyCsrfToken(headerToken, cookieToken)) {
    return new NextResponse(
      JSON.stringify({
        error: "Invalid CSRF token",
        code: "CSRF_TOKEN_INVALID",
      }),
      {
        status: 403,
        headers: { "Content-Type": "application/json" },
      }
    )
  }

  // Rate limiting
  const identifier = getClientIdentifier(request)
  const allowed = await Promise.resolve(apiLimiter.check(identifier))
  if (!allowed) {
    return new NextResponse(
      JSON.stringify({
        error: "Too many requests. Please try again later.",
      }),
      {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "Retry-After": "60",
        },
      }
    )
  }

  try {
    const { userId } = await auth()

    if (!userId) {
      return new NextResponse("Unauthorized", { status: 401 })
    }

    const currentUser = await prisma.user.findUnique({
      where: { clerkId: userId },
      select: { id: true, email: true },
    })
    if (!currentUser) {
      return new NextResponse("User not found", { status: 401 })
    }

    const body = await request.json()

    // Validate request body with Zod schema
    const validation = createMessageSchema.safeParse(body)
    if (!validation.success) {
      return new NextResponse(JSON.stringify({ error: validation.error.issues[0].message }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      })
    }

    const { message, image, audioUrl, audioTranscript, conversationId, replyToId } = validation.data

    // Sanitize user input to prevent XSS attacks
    const sanitizedMessage = message ? sanitizeMessage(message) : ""
    const sanitizedImage = image ? sanitizeUrl(image) : null
    const sanitizedAudioUrl = audioUrl ? sanitizeUrl(audioUrl) : null
    const sanitizedTranscript = audioTranscript ? sanitizeMessage(audioTranscript) : null

    // Validate that we have either a message, an image, or audio
    if (!sanitizedMessage && !sanitizedImage && !sanitizedAudioUrl) {
      return new NextResponse(JSON.stringify({ error: "Message, image, or audio is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      })
    }

    const moderationText = sanitizedMessage || sanitizedTranscript || ""
    const moderationResult = await moderateTextModelAssisted(moderationText)
    if (moderationResult.shouldBlock) {
      return new NextResponse(
        JSON.stringify({
          error: "Message was blocked by safety filters.",
          code: "CONTENT_BLOCKED",
          categories: moderationResult.categories,
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      )
    }

    // Verify user is a participant in this conversation
    const conversation = await prisma.conversation.findFirst({
      where: {
        id: conversationId,
        users: {
          some: {
            id: currentUser.id,
          },
        },
      },
      select: { id: true },
    })

    if (!conversation) {
      return new NextResponse(JSON.stringify({ error: "Not authorized for this conversation" }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      })
    }

    // If replyToId is provided, verify the message exists and belongs to this conversation
    if (replyToId) {
      const replyMessage = await prisma.message.findFirst({
        where: {
          id: replyToId,
          conversationId,
        },
      })

      if (!replyMessage) {
        return new NextResponse(
          JSON.stringify({ error: "Reply message not found or not in this conversation" }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        )
      }
    }

    const newMessage = await prisma.message.create({
      data: {
        body: sanitizedMessage,
        image: sanitizedImage,
        audioUrl: sanitizedAudioUrl,
        audioTranscript:
          sanitizedTranscript ?? (sanitizedAudioUrl && sanitizedMessage ? sanitizedMessage : null),
        conversationId,
        senderId: currentUser.id,
        replyToId: replyToId || null,
        seen: {
          connect: {
            id: currentUser.id,
          },
        },
      },
      include: {
        sender: true,
        seen: true,
        replyTo: {
          include: {
            sender: true,
          },
        },
      },
    })

    if (moderationResult.shouldReview) {
      await prisma.contentReport.create({
        data: {
          reporterId: currentUser.id,
          targetType: "MESSAGE",
          targetId: newMessage.id,
          reason: moderationReasonFromCategories(moderationResult.categories),
          details: buildModerationDetails(moderationResult, "message"),
          status: "OPEN",
        },
      })
    }

    // Update conversation's lastMessageAt - only select users for notifications
    // Avoid N+1 query by not loading all messages
    const updatedConversation = await prisma.conversation.update({
      where: {
        id: conversationId,
      },
      data: {
        lastMessageAt: new Date(),
        messages: {
          connect: {
            id: newMessage.id,
          },
        },
      },
      include: {
        users: {
          select: {
            id: true,
            email: true,
          },
        },
      },
    })

    // Trigger Pusher events for real-time updates
    await pusherServer.trigger(
      getPusherConversationChannel(conversationId),
      "messages:new",
      newMessage
    )

    // Notify all users in the conversation
    updatedConversation.users.forEach((user: { id: string }) => {
      pusherServer.trigger(getPusherUserChannel(user.id), "conversation:update", {
        id: conversationId,
        messages: [newMessage],
      })
    })

    return NextResponse.json(newMessage)
  } catch (error) {
    return new NextResponse("Error", { status: 500 })
  }
}
