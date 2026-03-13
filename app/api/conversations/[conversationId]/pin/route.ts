import { NextResponse, type NextRequest } from "next/server"

import { getCsrfTokenFromRequest, verifyCsrfToken } from "@/app/lib/csrf"
import { apiLogger } from "@/app/lib/logger"
import prisma from "@/app/lib/prismadb"
import { getPusherUserChannel } from "@/app/lib/pusher-channels"
import { pusherServer } from "@/app/lib/pusher-server"
import { apiLimiter, getClientIdentifier } from "@/app/lib/rate-limit"
import getCurrentUser from "@/app/actions/getCurrentUser"

// POST /api/conversations/[conversationId]/pin - Pin a conversation
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  try {
    // CSRF Protection
    if (!verifyCsrfToken(request.headers.get("X-CSRF-Token"), getCsrfTokenFromRequest(request))) {
      return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 })
    }

    const currentUser = await getCurrentUser()

    // Rate limiting
    if (!(await Promise.resolve(apiLimiter.check(getClientIdentifier(request))))) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 })
    }
    const { conversationId } = await params

    if (!currentUser?.id || !currentUser?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Find the conversation
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        users: true,
      },
    })

    if (!conversation) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 })
    }

    // Check if user is part of the conversation
    const isUserInConversation = conversation.users.some(
      (user: { id: string }) => user.id === currentUser.id
    )

    if (!isUserInConversation) {
      return NextResponse.json({ error: "You are not part of this conversation" }, { status: 403 })
    }

    // Check if already pinned by this user
    const pinnedBy = conversation.pinnedBy || []
    if (pinnedBy.includes(currentUser.id)) {
      return NextResponse.json({ error: "Conversation already pinned" }, { status: 400 })
    }

    // Add user to pinnedBy array
    const updatedPinnedBy = [...pinnedBy, currentUser.id]

    // Atomically check the pin limit and perform the update to prevent TOCTOU race conditions
    let updatedConversation
    try {
      updatedConversation = await prisma.$transaction(async (tx) => {
        const pinnedCount = await tx.conversation.count({
          where: {
            pinnedBy: {
              has: currentUser.id,
            },
          },
        })

        if (pinnedCount >= 5) {
          throw new Error("MAX_PINS_REACHED")
        }

        return tx.conversation.update({
          where: { id: conversationId },
          data: {
            pinnedBy: updatedPinnedBy,
            // Set pinnedAt timestamp only if this is the first pin
            pinnedAt: pinnedBy.length === 0 ? new Date() : conversation.pinnedAt,
          },
          include: {
            users: true,
            messages: {
              include: {
                sender: true,
                seen: true,
              },
              orderBy: {
                createdAt: "desc",
              },
              take: 1,
            },
          },
        })
      })
    } catch (txError) {
      if (txError instanceof Error && txError.message === "MAX_PINS_REACHED") {
        return NextResponse.json(
          { error: "You can only pin up to 5 conversations. Unpin one to pin another." },
          { status: 400 }
        )
      }
      throw txError
    }

    // Trigger Pusher event for real-time update (only to the user who pinned)
    await pusherServer.trigger(
      getPusherUserChannel(currentUser.id),
      "conversation:pin",
      updatedConversation
    )

    return NextResponse.json(updatedConversation)
  } catch (error: unknown) {
    apiLogger.error({ err: error }, "CONVERSATION_PIN_ERROR")
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// DELETE /api/conversations/[conversationId]/pin - Unpin a conversation
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  try {
    // CSRF Protection
    if (!verifyCsrfToken(request.headers.get("X-CSRF-Token"), getCsrfTokenFromRequest(request))) {
      return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 })
    }

    // Rate limiting
    if (!(await Promise.resolve(apiLimiter.check(getClientIdentifier(request))))) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 })
    }

    const currentUser = await getCurrentUser()
    const { conversationId } = await params

    if (!currentUser?.id || !currentUser?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Find the conversation
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        users: true,
      },
    })

    if (!conversation) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 })
    }

    // Check if user is part of the conversation
    const isUserInConversation = conversation.users.some(
      (user: { id: string }) => user.id === currentUser.id
    )

    if (!isUserInConversation) {
      return NextResponse.json({ error: "You are not part of this conversation" }, { status: 403 })
    }

    // Check if pinned by this user
    const pinnedBy = conversation.pinnedBy || []
    if (!pinnedBy.includes(currentUser.id)) {
      return NextResponse.json({ error: "Conversation is not pinned" }, { status: 400 })
    }

    // Remove user from pinnedBy array
    const updatedPinnedBy = pinnedBy.filter((id: string) => id !== currentUser.id)

    // Update conversation
    const updatedConversation = await prisma.conversation.update({
      where: { id: conversationId },
      data: {
        pinnedBy: updatedPinnedBy,
        // Clear pinnedAt if no users have it pinned anymore
        pinnedAt: updatedPinnedBy.length === 0 ? null : conversation.pinnedAt,
      },
      include: {
        users: true,
        messages: {
          include: {
            sender: true,
            seen: true,
          },
          orderBy: {
            createdAt: "desc",
          },
          take: 1,
        },
      },
    })

    // Trigger Pusher event for real-time update (only to the user who unpinned)
    await pusherServer.trigger(
      getPusherUserChannel(currentUser.id),
      "conversation:unpin",
      updatedConversation
    )

    return NextResponse.json(updatedConversation)
  } catch (error: unknown) {
    apiLogger.error({ err: error }, "CONVERSATION_UNPIN_ERROR")
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
