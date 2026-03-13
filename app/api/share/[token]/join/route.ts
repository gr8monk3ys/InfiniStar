/**
 * Join via Share Token API Route
 *
 * POST /api/share/[token]/join - Join conversation using share token
 *
 * This endpoint requires authentication but allows joining via the share token directly.
 */

import { NextResponse, type NextRequest } from "next/server"

import { getCsrfTokenFromRequest, verifyCsrfToken } from "@/app/lib/csrf"
import { apiLogger } from "@/app/lib/logger"
import prisma from "@/app/lib/prismadb"
import { getPusherUserChannel } from "@/app/lib/pusher-channels"
import { pusherServer } from "@/app/lib/pusher-server"
import { getClientIdentifier, shareJoinLimiter } from "@/app/lib/rate-limit"
import { joinViaShare } from "@/app/lib/sharing"
import getCurrentUser from "@/app/actions/getCurrentUser"

interface IParams {
  token: string
}

// POST - Join conversation via share token
export async function POST(request: NextRequest, { params }: { params: Promise<IParams> }) {
  try {
    // CSRF Protection
    if (!verifyCsrfToken(request.headers.get("X-CSRF-Token"), getCsrfTokenFromRequest(request))) {
      return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 })
    }

    // Rate limiting
    const identifier = getClientIdentifier(request)
    const allowed = await Promise.resolve(shareJoinLimiter.check(identifier))
    if (!allowed) {
      return NextResponse.json(
        { error: "Too many join attempts. Please try again later." },
        { status: 429 }
      )
    }

    const currentUser = await getCurrentUser()
    const { token } = await params

    if (!currentUser?.id || !currentUser?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (!token) {
      return NextResponse.json({ error: "Share token is required" }, { status: 400 })
    }

    // Join the conversation
    const result = await joinViaShare(currentUser.id, currentUser.email, token)

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 403 })
    }

    // Get the updated conversation to return
    const conversation = await prisma.conversation.findUnique({
      where: { id: result.conversationId },
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

    // Notify other users in the conversation about the new participant
    if (conversation) {
      for (const user of conversation.users) {
        if (user.id !== currentUser.id) {
          await pusherServer.trigger(
            getPusherUserChannel(user.id),
            "conversation:update",
            conversation
          )
        }
      }
    }

    return NextResponse.json({
      success: true,
      conversationId: result.conversationId,
      permission: result.permission,
      conversation,
    })
  } catch (error) {
    apiLogger.error({ err: error }, "Error joining via share token")
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
