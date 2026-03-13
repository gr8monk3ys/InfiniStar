import { NextResponse, type NextRequest } from "next/server"

import { getCsrfTokenFromRequest, verifyCsrfToken } from "@/app/lib/csrf"
import { apiLogger } from "@/app/lib/logger"
import prisma from "@/app/lib/prismadb"
import { getPusherUserChannel } from "@/app/lib/pusher-channels"
import { pusherServer } from "@/app/lib/pusher-server"
import { apiLimiter, getClientIdentifier } from "@/app/lib/rate-limit"
import getCurrentUser from "@/app/actions/getCurrentUser"

// POST /api/conversations/[conversationId]/archive - Archive a conversation
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

    // Check if already archived by this user
    const archivedBy = conversation.archivedBy || []
    if (archivedBy.includes(currentUser.id)) {
      return NextResponse.json({ error: "Conversation already archived" }, { status: 400 })
    }

    // Add user to archivedBy array
    const updatedArchivedBy = [...archivedBy, currentUser.id]

    // Update conversation
    const updatedConversation = await prisma.conversation.update({
      where: { id: conversationId },
      data: {
        archivedBy: updatedArchivedBy,
        // Set archivedAt timestamp only if this is the first archive
        archivedAt: archivedBy.length === 0 ? new Date() : conversation.archivedAt,
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

    // Trigger Pusher event for real-time update (only to the user who archived)
    await pusherServer.trigger(
      getPusherUserChannel(currentUser.id),
      "conversation:archive",
      updatedConversation
    )

    return NextResponse.json(updatedConversation)
  } catch (error: unknown) {
    apiLogger.error({ err: error }, "CONVERSATION_ARCHIVE_ERROR")
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// DELETE /api/conversations/[conversationId]/archive - Unarchive a conversation
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

    // Check if archived by this user
    const archivedBy = conversation.archivedBy || []
    if (!archivedBy.includes(currentUser.id)) {
      return NextResponse.json({ error: "Conversation is not archived" }, { status: 400 })
    }

    // Remove user from archivedBy array
    const updatedArchivedBy = archivedBy.filter((id: string) => id !== currentUser.id)

    // Update conversation
    const updatedConversation = await prisma.conversation.update({
      where: { id: conversationId },
      data: {
        archivedBy: updatedArchivedBy,
        // Clear archivedAt if no users have it archived anymore
        archivedAt: updatedArchivedBy.length === 0 ? null : conversation.archivedAt,
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

    // Trigger Pusher event for real-time update (only to the user who unarchived)
    await pusherServer.trigger(
      getPusherUserChannel(currentUser.id),
      "conversation:unarchive",
      updatedConversation
    )

    return NextResponse.json(updatedConversation)
  } catch (error: unknown) {
    apiLogger.error({ err: error }, "CONVERSATION_UNARCHIVE_ERROR")
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
