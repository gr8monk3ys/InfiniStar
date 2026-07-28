import { NextResponse, type NextRequest } from "next/server"

import { getCsrfTokenFromRequest, verifyCsrfToken } from "@/app/lib/csrf"
import { apiLogger } from "@/app/lib/logger"
import prisma from "@/app/lib/prismadb"
import { getPusherUserChannel } from "@/app/lib/pusher-channels"
import { pusherServer } from "@/app/lib/pusher-server"
import getCurrentUser from "@/app/actions/getCurrentUser"

interface IParams {
  conversationId?: string
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<IParams> }) {
  try {
    // CSRF Protection
    const headerToken = request.headers.get("X-CSRF-Token")
    const cookieToken = getCsrfTokenFromRequest(request)

    if (!verifyCsrfToken(headerToken, cookieToken)) {
      return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 })
    }

    const { conversationId } = await params
    const currentUser = await getCurrentUser()

    if (!currentUser?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const existingConversation = await prisma.conversation.findUnique({
      where: {
        id: conversationId,
      },
      include: {
        users: true,
      },
    })

    if (!existingConversation) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 })
    }

    const deletedConversation = await prisma.conversation.deleteMany({
      where: {
        id: conversationId,
        users: {
          some: {
            id: currentUser.id,
          },
        },
      },
    })

    // forEach cannot await, so these triggers used to be fired and dropped:
    // a Pusher failure surfaced as an unhandled rejection instead of a log, and
    // the response could return before any event was delivered.
    await Promise.all(
      existingConversation.users.map((user: { id: string }) =>
        pusherServer.trigger(
          getPusherUserChannel(user.id),
          "conversation:remove",
          existingConversation
        )
      )
    )

    return NextResponse.json(deletedConversation)
  } catch (error) {
    apiLogger.error({ err: error }, "CONVERSATION_DELETE_ERROR")
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
