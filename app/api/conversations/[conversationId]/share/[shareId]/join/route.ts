/**
 * Join Conversation via Share API Route
 *
 * POST /api/conversations/[conversationId]/share/[shareId]/join - Join via share
 */

import { NextResponse, type NextRequest } from "next/server"

import { verifyCsrfToken } from "@/app/lib/csrf"
import prisma from "@/app/lib/prismadb"
import { pusherServer } from "@/app/lib/pusher"
import { getClientIdentifier, shareJoinLimiter } from "@/app/lib/rate-limit"
import { joinViaShare } from "@/app/lib/sharing"
import getCurrentUser from "@/app/actions/getCurrentUser"

// Helper function to validate CSRF token
function validateCsrf(request: NextRequest): boolean {
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

  return verifyCsrfToken(headerToken, cookieToken)
}

interface IParams {
  conversationId: string
  shareId: string
}

// POST - Join conversation via share
export async function POST(request: NextRequest, { params }: { params: Promise<IParams> }) {
  try {
    // CSRF Protection
    if (!validateCsrf(request)) {
      return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 })
    }

    // Rate limiting
    const identifier = getClientIdentifier(request)
    if (!shareJoinLimiter.check(identifier)) {
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
        if (user.id !== currentUser.id && user.email) {
          await pusherServer.trigger(user.email, "conversation:update", conversation)
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
    console.error("JOIN_SHARE_ERROR", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
