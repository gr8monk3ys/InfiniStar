import { NextResponse, type NextRequest } from "next/server"

import { verifyCsrfToken } from "@/app/lib/csrf"
import prisma from "@/app/lib/prismadb"
import { pusherServer } from "@/app/lib/pusher"
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
    const cookieHeader = request.headers.get("cookie")
    let cookieToken: string | null = null

    if (cookieHeader) {
      const cookies = cookieHeader.split(";").reduce((acc, cookie) => {
        const [key, value] = cookie.trim().split("=")
        acc[key] = value
        return acc
      }, {} as Record<string, string>)
      cookieToken = cookies["csrf-token"] || null
    }

    if (!verifyCsrfToken(headerToken, cookieToken)) {
      return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 })
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
        userIds: {
          has: currentUser.id,
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

    await pusherServer.trigger(conversationId, "user:typing", typingPayload)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Typing indicator error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
