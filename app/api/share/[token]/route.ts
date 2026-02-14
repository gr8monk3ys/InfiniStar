/**
 * Public Share Info API Route
 *
 * GET /api/share/[token] - Get share info by token (public endpoint)
 *
 * This endpoint is public and does not require authentication.
 * It returns limited information about the share for display on the join page.
 */

import { NextResponse, type NextRequest } from "next/server"

import { getClientIdentifier, shareJoinLimiter } from "@/app/lib/rate-limit"
import { getShareByToken } from "@/app/lib/sharing"

interface IParams {
  token: string
}

// GET - Get share info by token (public)
export async function GET(request: NextRequest, { params }: { params: Promise<IParams> }) {
  try {
    // Rate limiting to prevent abuse
    const identifier = getClientIdentifier(request)
    const allowed = await Promise.resolve(shareJoinLimiter.check(identifier))
    if (!allowed) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429 }
      )
    }

    const { token } = await params

    if (!token) {
      return NextResponse.json({ error: "Share token is required" }, { status: 400 })
    }

    // Get share info
    const result = await getShareByToken(token)

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 404 })
    }

    // Return sanitized share info for public display
    // We deliberately limit what information is exposed
    return NextResponse.json({
      shareInfo: {
        id: result.shareInfo!.id,
        conversationName: result.shareInfo!.conversationName || "Untitled Conversation",
        messageCount: result.shareInfo!.messageCount,
        participantCount: result.shareInfo!.participantCount,
        permission: result.shareInfo!.permission,
        shareType: result.shareInfo!.shareType,
        expiresAt: result.shareInfo!.expiresAt,
      },
    })
  } catch (error) {
    console.error("GET_SHARE_INFO_ERROR", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
