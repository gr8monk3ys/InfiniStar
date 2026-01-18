import { NextResponse } from "next/server"

import prisma from "@/app/lib/prismadb"
import { pusherServer } from "@/app/lib/pusher"
import getCurrentUser from "@/app/actions/getCurrentUser"

export async function POST(request: Request) {
  const currentUser = await getCurrentUser()

  if (!currentUser?.id || !currentUser?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await request.text()
  const params = new URLSearchParams(body)
  const socketId = params.get("socket_id")
  const channel = params.get("channel_name")

  if (!socketId || !channel) {
    return NextResponse.json({ error: "Missing parameters" }, { status: 400 })
  }

  // Validate channel access based on channel type
  // Conversation channels: conversation-{conversationId}
  // User channels: user-{userId}
  // Presence channels: presence-messenger
  if (channel.startsWith("conversation-")) {
    const conversationId = channel.replace("conversation-", "")

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
      return NextResponse.json({ error: "Not authorized for this conversation" }, { status: 403 })
    }
  } else if (channel.startsWith("user-")) {
    // User channels should only be accessible by the user themselves
    const channelUserId = channel.replace("user-", "")
    if (channelUserId !== currentUser.id) {
      return NextResponse.json({ error: "Not authorized for this channel" }, { status: 403 })
    }
  }
  // Allow presence-messenger and email-based channels for general presence

  const data = {
    user_id: currentUser.email,
  }

  const authResponse = pusherServer.authorizeChannel(socketId, channel, data)
  return NextResponse.json(authResponse)
}
