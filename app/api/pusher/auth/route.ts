import { NextResponse, type NextRequest } from "next/server"

import { verifyCsrfToken } from "@/app/lib/csrf"
import prisma from "@/app/lib/prismadb"
import { pusherServer } from "@/app/lib/pusher"
import { apiLimiter, getClientIdentifier } from "@/app/lib/rate-limit"
import getCurrentUser from "@/app/actions/getCurrentUser"

export async function POST(request: NextRequest) {
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
    return NextResponse.json(
      { error: "Invalid CSRF token", code: "CSRF_TOKEN_INVALID" },
      { status: 403 }
    )
  }

  // Rate limiting
  const identifier = getClientIdentifier(request)
  if (!apiLimiter.check(identifier)) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429, headers: { "Retry-After": "60" } }
    )
  }

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
