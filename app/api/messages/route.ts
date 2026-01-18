import { NextResponse, type NextRequest } from "next/server"
import { getServerSession } from "next-auth"

import { authOptions } from "@/app/lib/auth"
import { verifyCsrfToken } from "@/app/lib/csrf"
import prisma from "@/app/lib/prismadb"
import { pusherServer } from "@/app/lib/pusher"
import { apiLimiter, getClientIdentifier } from "@/app/lib/rate-limit"
import { sanitizeMessage, sanitizeUrl } from "@/app/lib/sanitize"

export async function POST(request: NextRequest) {
  // CSRF Protection
  const headerToken = request.headers.get("X-CSRF-Token")
  const cookieHeader = request.headers.get("cookie")
  let cookieToken: string | null = null

  if (cookieHeader) {
    const cookies = cookieHeader.split(";").reduce((acc, cookie) => {
      const [key, value] = cookie.trim().split("=")
      acc[key] = value
      return acc
    }, {} as Record<string, string>)
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
  if (!apiLimiter.check(identifier)) {
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
    const session = await getServerSession(authOptions)
    const currentUser = session?.user
    const body = await request.json()
    const { message, image, conversationId, replyToId } = body

    if (!currentUser?.id || !currentUser?.email) {
      return new NextResponse("Unauthorized", { status: 401 })
    }

    // Sanitize user input to prevent XSS attacks
    const sanitizedMessage = message ? sanitizeMessage(message) : ""
    const sanitizedImage = image ? sanitizeUrl(image) : null

    // Validate that we have either a message or an image
    if (!sanitizedMessage && !sanitizedImage) {
      return new NextResponse(JSON.stringify({ error: "Message or image is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      })
    }

    // Verify user is a participant in this conversation
    const conversation = await prisma.conversation.findFirst({
      where: {
        id: conversationId,
        userIds: {
          has: currentUser.id,
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
        users: true,
        messages: {
          include: {
            sender: true,
            seen: true,
          },
        },
      },
    })

    // Trigger Pusher events for real-time updates
    await pusherServer.trigger(conversationId, "messages:new", newMessage)

    // Notify all users in the conversation
    updatedConversation.users.forEach((user) => {
      pusherServer.trigger(user.email!, "conversation:update", {
        id: conversationId,
        messages: [newMessage],
      })
    })

    return NextResponse.json(newMessage)
  } catch (error) {
    return new NextResponse("Error", { status: 500 })
  }
}
