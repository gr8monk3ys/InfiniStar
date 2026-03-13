import { NextResponse, type NextRequest } from "next/server"

import { markConversationSeenByUserId } from "@/app/lib/conversation-seen"
import { getCsrfTokenFromRequest, verifyCsrfToken } from "@/app/lib/csrf"
import { apiLogger } from "@/app/lib/logger"
import { apiLimiter } from "@/app/lib/rate-limit"
import getCurrentUser from "@/app/actions/getCurrentUser"

interface IParams {
  conversationId?: string
}

export async function POST(request: NextRequest, { params }: { params: Promise<IParams> }) {
  try {
    // CSRF Protection
    const headerToken = request.headers.get("X-CSRF-Token")
    const cookieToken = getCsrfTokenFromRequest(request)

    if (!verifyCsrfToken(headerToken, cookieToken)) {
      return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 })
    }

    const currentUser = await getCurrentUser()
    const { conversationId } = await params

    if (!currentUser?.id || !currentUser?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (!apiLimiter.check(currentUser.id)) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 })
    }

    const result = await markConversationSeenByUserId({
      conversationId: conversationId ?? "",
      currentUserId: currentUser.id,
    })

    if (!result.foundConversation) {
      return NextResponse.json(
        { error: "Conversation not found or not authorized" },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true, updated: result.updated })
  } catch (error) {
    apiLogger.error({ err: error }, "CONVERSATION_SEEN_ERROR")
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
