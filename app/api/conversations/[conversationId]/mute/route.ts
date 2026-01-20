import { NextResponse, type NextRequest } from "next/server"

import prisma from "@/app/lib/prismadb"
import { pusherServer } from "@/app/lib/pusher"
import getCurrentUser from "@/app/actions/getCurrentUser"

// POST /api/conversations/[conversationId]/mute - Mute a conversation
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  try {
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
    const isUserInConversation = conversation.users.some((user) => user.id === currentUser.id)

    if (!isUserInConversation) {
      return NextResponse.json({ error: "You are not part of this conversation" }, { status: 403 })
    }

    // Check if already muted by this user
    const mutedBy = conversation.mutedBy || []
    if (mutedBy.includes(currentUser.id)) {
      return NextResponse.json({ error: "Conversation already muted" }, { status: 400 })
    }

    // Add user to mutedBy array
    const updatedMutedBy = [...mutedBy, currentUser.id]

    // Update conversation
    const updatedConversation = await prisma.conversation.update({
      where: { id: conversationId },
      data: {
        mutedBy: updatedMutedBy,
        // Set mutedAt timestamp only if this is the first mute
        mutedAt: mutedBy.length === 0 ? new Date() : conversation.mutedAt,
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

    // Trigger Pusher event for real-time update (only to the user who muted)
    await pusherServer.trigger(`user-${currentUser.id}`, "conversation:mute", updatedConversation)

    return NextResponse.json(updatedConversation)
  } catch (error: unknown) {
    console.error("CONVERSATION_MUTE_ERROR", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// DELETE /api/conversations/[conversationId]/mute - Unmute a conversation
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  try {
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
    const isUserInConversation = conversation.users.some((user) => user.id === currentUser.id)

    if (!isUserInConversation) {
      return NextResponse.json({ error: "You are not part of this conversation" }, { status: 403 })
    }

    // Check if muted by this user
    const mutedBy = conversation.mutedBy || []
    if (!mutedBy.includes(currentUser.id)) {
      return NextResponse.json({ error: "Conversation is not muted" }, { status: 400 })
    }

    // Remove user from mutedBy array
    const updatedMutedBy = mutedBy.filter((id) => id !== currentUser.id)

    // Update conversation
    const updatedConversation = await prisma.conversation.update({
      where: { id: conversationId },
      data: {
        mutedBy: updatedMutedBy,
        // Clear mutedAt if no users have it muted anymore
        mutedAt: updatedMutedBy.length === 0 ? null : conversation.mutedAt,
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

    // Trigger Pusher event for real-time update (only to the user who unmuted)
    await pusherServer.trigger(`user-${currentUser.id}`, "conversation:unmute", updatedConversation)

    return NextResponse.json(updatedConversation)
  } catch (error: unknown) {
    console.error("CONVERSATION_UNMUTE_ERROR", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
