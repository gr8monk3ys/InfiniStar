import { NextResponse, type NextRequest } from "next/server"

import { getCsrfTokenFromRequest, verifyCsrfToken } from "@/app/lib/csrf"
import prisma from "@/app/lib/prismadb"
import { pusherServer } from "@/app/lib/pusher"
import { getPusherConversationChannel } from "@/app/lib/pusher-channels"
import { apiLimiter, getClientIdentifier } from "@/app/lib/rate-limit"
import getCurrentUser from "@/app/actions/getCurrentUser"

interface IParams {
  conversationId?: string
}

interface TypingPayload {
  userId: string
  userName: string
  isTyping: boolean
}

/**
 * POST /api/conversations/[conversationId]/typing
 * Broadcasts typing status to other users in the conversation
 */
export async function POST(request: NextRequest, { params }: { params: Promise<IParams> }) {
  try {
    // CSRF Protection
    const headerToken = request.headers.get("X-CSRF-Token")
    const cookieToken = getCsrfTokenFromRequest(request)

    if (!verifyCsrfToken(headerToken, cookieToken)) {
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

    if (!conversationId) {
      return NextResponse.json({ error: "Conversation ID is required" }, { status: 400 })
    }

    // Parse request body
    const body = await request.json()
    const { isTyping } = body

    if (typeof isTyping !== "boolean") {
      return NextResponse.json({ error: "isTyping must be a boolean" }, { status: 400 })
    }

    // Verify user is a participant in the conversation
    const conversation = await prisma.conversation.findFirst({
      where: {
        id: conversationId,
        users: {
          some: {
            id: currentUser.id,
          },
        },
      },
    })

    if (!conversation) {
      return NextResponse.json(
        { error: "Conversation not found or not authorized" },
        { status: 404 }
      )
    }

    // Broadcast typing status to the conversation channel
    const typingPayload: TypingPayload = {
      userId: currentUser.id,
      userName: currentUser.name || "Someone",
      isTyping,
    }

    await pusherServer.trigger(
      getPusherConversationChannel(conversationId),
      "user:typing",
      typingPayload
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Typing indicator error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
