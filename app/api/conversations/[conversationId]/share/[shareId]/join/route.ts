/**
 * Join Conversation via Share API Route
 *
 * POST /api/conversations/[conversationId]/share/[shareId]/join - Join via share
 */

import { NextResponse, type NextRequest } from "next/server"

import { publishParticipantJoined } from "@/app/lib/conversation-events"
import { MESSAGE_INCLUDE, PARTICIPANT_SELECT } from "@/app/lib/conversation-select"
import { getCsrfTokenFromRequest, verifyCsrfToken } from "@/app/lib/csrf"
import { apiLogger } from "@/app/lib/logger"
import prisma from "@/app/lib/prismadb"
import { getPusherUserChannel } from "@/app/lib/pusher-channels"
import { pusherServer } from "@/app/lib/pusher-server"
import { getClientIdentifier, shareJoinLimiter } from "@/app/lib/rate-limit"
import { joinViaShare } from "@/app/lib/sharing"
import getCurrentUser from "@/app/actions/getCurrentUser"

interface IParams {
  conversationId: string
  shareId: string
}

// POST - Join conversation via share
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
    const { shareId } = await params

    if (!currentUser?.id || !currentUser?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Get the share token from the share ID
    const share = await prisma.conversationShare.findUnique({
      where: { id: shareId },
    })

    if (!share) {
      return NextResponse.json({ error: "Share not found" }, { status: 404 })
    }

    // Join the conversation
    const result = await joinViaShare(currentUser.id, currentUser.email, share.shareToken)

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 403 })
    }

    // Get the updated conversation to return
    const conversation = await prisma.conversation.findUnique({
      where: { id: result.conversationId },
      include: {
        users: { select: PARTICIPANT_SELECT },
        messages: {
          include: MESSAGE_INCLUDE,
          orderBy: {
            createdAt: "desc",
          },
          take: 1,
        },
      },
    })

    // A new Participant is not a new message. This used to be sent as
    // `conversation:update`, whose handler keeps only `messages` and discards
    // `users`, so the join never reached anyone already in the conversation.
    if (conversation) {
      await publishParticipantJoined({
        conversationId: conversation.id,
        users: conversation.users,
        notify: conversation.users
          .filter((user) => user.id !== currentUser.id)
          .map((user) => user.id),
      })
    }

    return NextResponse.json({
      success: true,
      conversationId: result.conversationId,
      permission: result.permission,
      conversation,
    })
  } catch (error) {
    apiLogger.error({ err: error }, "JOIN_SHARE_ERROR")
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
