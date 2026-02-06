import { NextResponse, type NextRequest } from "next/server"
import { getServerSession } from "next-auth"
import { z } from "zod"

import { authOptions } from "@/app/lib/auth"
import { verifyCsrfToken } from "@/app/lib/csrf"
import prisma from "@/app/lib/prismadb"
import { pusherServer } from "@/app/lib/pusher"
import { getClientIdentifier, tagLimiter } from "@/app/lib/rate-limit"

// Validation schema for adding a tag to conversation
const addTagSchema = z.object({
  tagId: z.string().min(1, "Tag ID is required"),
})

interface RouteParams {
  params: Promise<{
    conversationId: string
  }>
}

/**
 * GET /api/conversations/[conversationId]/tags
 * Get all tags for a conversation
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { conversationId } = await params
    const session = await getServerSession(authOptions)
    const currentUser = session?.user

    if (!currentUser?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Find the conversation and verify user is a participant
    const conversation = await prisma.conversation.findUnique({
      where: {
        id: conversationId,
      },
      select: {
        users: {
          select: { id: true },
        },
        tags: {
          where: {
            userId: currentUser.id,
          },
        },
      },
    })

    if (!conversation) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 })
    }

    // Verify user is a participant
    if (!conversation.users.some((user) => user.id === currentUser.id)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
    }

    return NextResponse.json({ tags: conversation.tags })
  } catch (error) {
    console.error("Error fetching conversation tags:", error)
    return NextResponse.json({ error: "Failed to fetch tags" }, { status: 500 })
  }
}

/**
 * POST /api/conversations/[conversationId]/tags
 * Add a tag to a conversation
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { conversationId } = await params

    // Rate limiting
    const identifier = getClientIdentifier(request)
    if (!tagLimiter.check(identifier)) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429 }
      )
    }

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
      return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 })
    }

    const session = await getServerSession(authOptions)
    const currentUser = session?.user

    if (!currentUser?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()

    // Validate input
    const validationResult = addTagSchema.safeParse(body)
    if (!validationResult.success) {
      return NextResponse.json({ error: validationResult.error.issues[0].message }, { status: 400 })
    }

    const { tagId } = validationResult.data

    // Find the conversation and verify user is a participant
    const conversation = await prisma.conversation.findUnique({
      where: {
        id: conversationId,
      },
      select: {
        id: true,
        users: {
          select: { id: true },
        },
        tags: {
          select: { id: true },
        },
      },
    })

    if (!conversation) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 })
    }

    // Verify user is a participant
    if (!conversation.users.some((user) => user.id === currentUser.id)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
    }

    // Verify the tag exists and belongs to the user
    const tag = await prisma.tag.findUnique({
      where: {
        id: tagId,
      },
    })

    if (!tag) {
      return NextResponse.json({ error: "Tag not found" }, { status: 404 })
    }

    if (tag.userId !== currentUser.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
    }

    // Check if tag is already attached
    if (conversation.tags.some((tagItem) => tagItem.id === tagId)) {
      return NextResponse.json({ error: "Tag already attached to conversation" }, { status: 409 })
    }

    // Check tag limit per conversation (max 5 tags)
    const userTagsOnConversation = await prisma.tag.count({
      where: {
        conversations: {
          some: { id: conversationId },
        },
        userId: currentUser.id,
      },
    })

    if (userTagsOnConversation >= 5) {
      return NextResponse.json(
        { error: "Maximum tags per conversation (5) reached" },
        { status: 400 }
      )
    }

    // Add the tag to the conversation
    const updatedConversation = await prisma.conversation.update({
      where: {
        id: conversationId,
      },
      data: {
        tags: {
          connect: {
            id: tagId,
          },
        },
      },
      include: {
        tags: {
          where: {
            userId: currentUser.id,
          },
        },
        users: true,
        messages: {
          include: {
            sender: true,
            seen: true,
          },
        },
      },
    })

    // Trigger Pusher event for real-time update (user-specific)
    if (currentUser.email) {
      await pusherServer.trigger(currentUser.email, "conversation:tag:add", {
        conversationId,
        tag,
      })
    }

    return NextResponse.json({
      conversation: updatedConversation,
      tag,
    })
  } catch (error) {
    console.error("Error adding tag to conversation:", error)
    return NextResponse.json({ error: "Failed to add tag" }, { status: 500 })
  }
}
