import { NextResponse, type NextRequest } from "next/server"
import { getServerSession } from "next-auth"
import { z } from "zod"

import { authOptions } from "@/app/lib/auth"
import { verifyCsrfToken } from "@/app/lib/csrf"
import prisma from "@/app/lib/prismadb"
import { pusherServer } from "@/app/lib/pusher"
import { sanitizePlainText } from "@/app/lib/sanitize"

// Validation schema for creating conversations
const createConversationSchema = z
  .object({
    userId: z.string().min(1, "User ID is required").optional(),
    isGroup: z.boolean().optional(),
    members: z
      .array(z.string().min(1, "Member ID cannot be empty"))
      .min(2, "Group must have at least 2 members")
      .max(50, "Group cannot exceed 50 members")
      .optional(),
    name: z
      .string()
      .max(100, "Conversation name too long (max 100 characters)")
      .optional()
      .nullable(),
    isAI: z.boolean().optional(),
    aiModel: z
      .enum(["claude-3-5-sonnet-20241022", "claude-3-5-haiku-20241022", "claude-3-opus-20240229"])
      .optional(),
  })
  .refine(
    (data) => {
      // Ensure at least one valid conversation type is specified
      return data.isAI || data.isGroup || data.userId
    },
    { message: "Must specify userId for direct chat, isGroup for group chat, or isAI for AI chat" }
  )
  .refine(
    (data) => {
      // If isGroup is true, members must be provided
      if (data.isGroup && (!data.members || data.members.length < 2)) {
        return false
      }
      return true
    },
    { message: "Group conversations require at least 2 members" }
  )

export async function POST(request: NextRequest) {
  try {
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
      return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 })
    }

    const session = await getServerSession(authOptions)
    const currentUser = session?.user

    if (!currentUser?.id || !currentUser?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()

    // Validate request body with Zod schema
    const validation = createConversationSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json({ error: validation.error.errors[0].message }, { status: 400 })
    }

    const { userId, isGroup, members, name, isAI, aiModel } = validation.data

    // Sanitize conversation name if provided
    const sanitizedName = name ? sanitizePlainText(name) : null

    // Handle AI conversation creation
    if (isAI) {
      const newConversation = await prisma.conversation.create({
        data: {
          name: sanitizedName || "AI Assistant",
          isAI: true,
          aiModel: aiModel || "claude-3-5-sonnet-20241022",
          users: {
            connect: {
              id: currentUser.id,
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

      // Trigger Pusher event for user
      if (currentUser.email) {
        pusherServer.trigger(currentUser.email, "conversation:new", newConversation)
      }

      return NextResponse.json(newConversation)
    }

    // Group conversation validation is handled by Zod schema
    if (isGroup && members) {
      const newConversation = await prisma.conversation.create({
        data: {
          name: sanitizedName,
          isGroup: true,
          users: {
            connect: members.map((id: string) => ({
              id,
            })),
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

      // Trigger Pusher event for all users in the conversation
      newConversation.users.forEach((user) => {
        if (user.email) {
          pusherServer.trigger(user.email, "conversation:new", newConversation)
        }
      })

      return NextResponse.json(newConversation)
    }

    // Direct 1-on-1 conversation requires userId
    if (!userId) {
      return NextResponse.json(
        { error: "User ID is required for direct conversations" },
        { status: 400 }
      )
    }

    const existingConversations = await prisma.conversation.findMany({
      where: {
        OR: [
          {
            userIds: {
              equals: [currentUser.id, userId],
            },
          },
          {
            userIds: {
              equals: [userId, currentUser.id],
            },
          },
        ],
      },
    })

    const singleConversation = existingConversations[0]

    if (singleConversation) {
      return NextResponse.json(singleConversation)
    }

    const newConversation = await prisma.conversation.create({
      data: {
        users: {
          connect: [
            {
              id: currentUser.id,
            },
            {
              id: userId,
            },
          ],
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

    // Trigger Pusher event for all users in the conversation
    newConversation.users.forEach((user) => {
      if (user.email) {
        pusherServer.trigger(user.email, "conversation:new", newConversation)
      }
    })

    return NextResponse.json(newConversation)
  } catch (error) {
    return new NextResponse("Internal Error", { status: 500 })
  }
}
