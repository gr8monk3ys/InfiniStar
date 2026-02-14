import { NextResponse, type NextRequest } from "next/server"

import prisma from "@/app/lib/prismadb"
import { pusherServer } from "@/app/lib/pusher"
import { PUSHER_PRESENCE_CHANNEL } from "@/app/lib/pusher-channels"
import { apiLimiter, getClientIdentifier } from "@/app/lib/rate-limit"
import getCurrentUser from "@/app/actions/getCurrentUser"

export async function POST(request: NextRequest) {
  // Rate limiting
  const identifier = getClientIdentifier(request)
  const allowed = await Promise.resolve(apiLimiter.check(identifier))
  if (!allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429, headers: { "Retry-After": "60" } }
    )
  }

  const currentUser = await getCurrentUser()

  if (!currentUser?.id) {
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
  // Conversation channels: private-conversation-{conversationId}
  // User channels: private-user-{userId}
  // Presence channels: presence-messenger
  const isPresenceChannel = channel === PUSHER_PRESENCE_CHANNEL

  if (channel.startsWith("private-conversation-")) {
    const conversationId = channel.replace("private-conversation-", "")

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
      return NextResponse.json({ error: "Not authorized for this conversation" }, { status: 403 })
    }
  } else if (channel.startsWith("private-user-")) {
    const channelUserId = channel.replace("private-user-", "")
    if (channelUserId !== currentUser.id) {
      return NextResponse.json({ error: "Not authorized for this channel" }, { status: 403 })
    }
  } else if (!isPresenceChannel) {
    // Do not authorize unknown channels.
    return NextResponse.json({ error: "Not authorized for this channel" }, { status: 403 })
  }

  // Presence channels must include a stable user_id (we use our internal UUID).
  const authResponse = isPresenceChannel
    ? pusherServer.authorizeChannel(socketId, channel, {
        user_id: currentUser.id,
        user_info: {
          name: currentUser.name || "Anonymous",
          image: currentUser.image || null,
        },
      })
    : pusherServer.authorizeChannel(socketId, channel)

  return NextResponse.json(authResponse)
}
