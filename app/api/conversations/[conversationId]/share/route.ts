/**
 * Conversation Share API Routes
 *
 * POST /api/conversations/[conversationId]/share - Create a share link
 * GET /api/conversations/[conversationId]/share - List all shares for a conversation
 */

import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"

import { verifyCsrfToken } from "@/app/lib/csrf"
import { getClientIdentifier, shareLimiter } from "@/app/lib/rate-limit"
import { createShareLink, getShareUrl, getSharesForConversation } from "@/app/lib/sharing"
import getCurrentUser from "@/app/actions/getCurrentUser"

// Validation schema for creating a share
const createShareSchema = z.object({
  shareType: z.enum(["LINK", "INVITE"]).optional().default("LINK"),
  permission: z.enum(["VIEW", "PARTICIPATE"]).optional().default("VIEW"),
  expiresAt: z
    .string()
    .datetime()
    .optional()
    .nullable()
    .transform((val) => (val ? new Date(val) : null)),
  maxUses: z.number().int().positive().optional().nullable(),
  allowedEmails: z.array(z.string().email()).optional().default([]),
  name: z.string().max(100).optional().nullable(),
})

// Helper function to validate CSRF token
function validateCsrf(request: NextRequest): boolean {
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

  return verifyCsrfToken(headerToken, cookieToken)
}

interface IParams {
  conversationId: string
}

// POST - Create a new share link
export async function POST(request: NextRequest, { params }: { params: Promise<IParams> }) {
  try {
    // CSRF Protection
    if (!validateCsrf(request)) {
      return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 })
    }

    // Rate limiting
    const identifier = getClientIdentifier(request)
    if (!shareLimiter.check(identifier)) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429 }
      )
    }

    const currentUser = await getCurrentUser()
    const { conversationId } = await params

    if (!currentUser?.id || !currentUser?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Parse and validate request body
    let body: unknown
    try {
      body = await request.json()
    } catch {
      body = {}
    }

    const validationResult = createShareSchema.safeParse(body)

    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: "Invalid request data",
          details: validationResult.error.flatten().fieldErrors,
        },
        { status: 400 }
      )
    }

    const { shareType, permission, expiresAt, maxUses, allowedEmails, name } = validationResult.data

    // Validate invite-only shares have allowed emails
    if (shareType === "INVITE" && allowedEmails.length === 0) {
      return NextResponse.json(
        { error: "Invite-only shares must have at least one allowed email" },
        { status: 400 }
      )
    }

    // Create the share
    const result = await createShareLink(currentUser.id, conversationId, {
      shareType: shareType as "LINK" | "INVITE",
      permission: permission as "VIEW" | "PARTICIPATE",
      expiresAt,
      maxUses,
      allowedEmails,
      name,
    })

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: result.error === "Conversation not found" ? 404 : 403 }
      )
    }

    // Return share with URL
    const shareUrl = getShareUrl(result.share!.shareToken)

    return NextResponse.json({
      share: result.share,
      shareUrl,
    })
  } catch (error) {
    console.error("CREATE_SHARE_ERROR", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// GET - List all shares for a conversation
export async function GET(request: NextRequest, { params }: { params: Promise<IParams> }) {
  try {
    const currentUser = await getCurrentUser()
    const { conversationId } = await params

    if (!currentUser?.id || !currentUser?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const result = await getSharesForConversation(currentUser.id, conversationId)

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: result.error === "Conversation not found" ? 404 : 403 }
      )
    }

    // Add share URLs to each share
    const sharesWithUrls = result.shares!.map((share: { shareToken: string; [key: string]: unknown }) => ({
      ...share,
      shareUrl: getShareUrl(share.shareToken),
    }))

    return NextResponse.json({ shares: sharesWithUrls })
  } catch (error) {
    console.error("GET_SHARES_ERROR", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
