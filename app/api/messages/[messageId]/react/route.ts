import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"

import prisma from "@/app/lib/prismadb"
import { pusherServer } from "@/app/lib/pusher"
import getCurrentUser from "@/app/actions/getCurrentUser"

// Validation schema
const reactionSchema = z.object({
  emoji: z.string().min(1).max(10), // Emoji as string
})

// POST /api/messages/[messageId]/react - Add or toggle a reaction
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ messageId: string }> }
) {
  try {
    const currentUser = await getCurrentUser()
    const { messageId } = await params

    if (!currentUser?.id || !currentUser?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Validate request body
    const body = await request.json()
    const validation = reactionSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json({ error: validation.error.errors[0].message }, { status: 400 })
    }

    const { emoji } = validation.data

    // Find the message
    const message = await prisma.message.findUnique({
      where: { id: messageId },
      include: {
        sender: true,
        seen: true,
      },
    })

    if (!message) {
      return NextResponse.json({ error: "Message not found" }, { status: 404 })
    }

    // Check if message is deleted
    if (message.isDeleted) {
      return NextResponse.json({ error: "Cannot react to deleted message" }, { status: 400 })
    }

    // Parse existing reactions
    const reactions = (message.reactions as Record<string, string[]>) || {}

    // Toggle reaction: if user already reacted with this emoji, remove it; otherwise add it
    if (reactions[emoji] && Array.isArray(reactions[emoji])) {
      if (reactions[emoji].includes(currentUser.id)) {
        // Remove user's reaction
        reactions[emoji] = reactions[emoji].filter((id) => id !== currentUser.id)
        // Remove emoji key if no reactions left
        if (reactions[emoji].length === 0) {
          delete reactions[emoji]
        }
      } else {
        // Add user's reaction
        reactions[emoji].push(currentUser.id)
      }
    } else {
      // First reaction with this emoji
      reactions[emoji] = [currentUser.id]
    }

    // Update the message
    const updatedMessage = await prisma.message.update({
      where: { id: messageId },
      data: {
        reactions: reactions,
      },
      include: {
        sender: true,
        seen: true,
      },
    })

    // Trigger Pusher event for real-time update
    await pusherServer.trigger(
      `conversation-${message.conversationId}`,
      "message:reaction",
      updatedMessage
    )

    return NextResponse.json(updatedMessage)
  } catch (error: any) {
    console.error("MESSAGE_REACTION_ERROR", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
