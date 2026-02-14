import { NextResponse, type NextRequest } from "next/server"
import { auth } from "@clerk/nextjs/server"

import { verifyCsrfToken } from "@/app/lib/csrf"
import prisma from "@/app/lib/prismadb"
import { pusherServer } from "@/app/lib/pusher"
import { getPusherUserChannel } from "@/app/lib/pusher-channels"
import { getClientIdentifier, tagLimiter } from "@/app/lib/rate-limit"

interface RouteParams {
  params: Promise<{
    conversationId: string
    tagId: string
  }>
}

/**
 * DELETE /api/conversations/[conversationId]/tags/[tagId]
 * Remove a tag from a conversation
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { conversationId, tagId } = await params

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

    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const currentUser = await prisma.user.findUnique({
      where: { clerkId: userId },
      select: { id: true },
    })
    if (!currentUser) {
      return NextResponse.json({ error: "User not found" }, { status: 401 })
    }

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
    if (!conversation.users.some((user: { id: string }) => user.id === currentUser.id)) {
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

    // Check if tag is attached to this conversation
    if (!conversation.tags.some((tagItem: { id: string }) => tagItem.id === tagId)) {
      return NextResponse.json(
        { error: "Tag is not attached to this conversation" },
        { status: 400 }
      )
    }

    // Remove the tag from the conversation
    const updatedConversation = await prisma.conversation.update({
      where: {
        id: conversationId,
      },
      data: {
        tags: {
          disconnect: {
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
    await pusherServer.trigger(getPusherUserChannel(currentUser.id), "conversation:tag:remove", {
      conversationId,
      tagId,
    })

    return NextResponse.json({
      conversation: updatedConversation,
      success: true,
    })
  } catch (error) {
    console.error("Error removing tag from conversation:", error)
    return NextResponse.json({ error: "Failed to remove tag" }, { status: 500 })
  }
}
