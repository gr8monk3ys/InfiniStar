/**
 * Individual Share API Routes
 *
 * PATCH /api/conversations/[conversationId]/share/[shareId] - Update share settings
 * DELETE /api/conversations/[conversationId]/share/[shareId] - Revoke/delete a share
 */

import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"

import { verifyCsrfToken } from "@/app/lib/csrf"
import { getClientIdentifier, shareLimiter } from "@/app/lib/rate-limit"
import { deleteShare, getShareUrl, updateShare } from "@/app/lib/sharing"
import getCurrentUser from "@/app/actions/getCurrentUser"

// Validation schema for updating a share
const updateShareSchema = z.object({
  permission: z.enum(["VIEW", "PARTICIPATE"]).optional(),
  expiresAt: z
    .string()
    .datetime()
    .optional()
    .nullable()
    .transform((val) => (val ? new Date(val) : null)),
  maxUses: z.number().int().positive().optional().nullable(),
  allowedEmails: z.array(z.string().email()).optional(),
  name: z.string().max(100).optional().nullable(),
  isActive: z.boolean().optional(),
})

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

// PATCH - Update share settings
export async function PATCH(request: NextRequest, { params }: { params: Promise<IParams> }) {
  try {
    // CSRF Protection
    if (!validateCsrf(request)) {
      return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 })
    }

    // Rate limiting
    const identifier = getClientIdentifier(request)
    const allowed = await Promise.resolve(shareLimiter.check(identifier))
    if (!allowed) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429 }
      )
    }

    const currentUser = await getCurrentUser()
    const { shareId } = await params

    if (!currentUser?.id || !currentUser?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Parse and validate request body
    const body = await request.json()
    const validationResult = updateShareSchema.safeParse(body)

    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: "Invalid request data",
          details: validationResult.error.flatten().fieldErrors,
        },
        { status: 400 }
      )
    }

    const updates = validationResult.data

    // Update the share
    const result = await updateShare(currentUser.id, shareId, {
      permission: updates.permission as "VIEW" | "PARTICIPATE" | undefined,
      expiresAt: updates.expiresAt,
      maxUses: updates.maxUses,
      allowedEmails: updates.allowedEmails,
      name: updates.name,
      isActive: updates.isActive,
    })

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: result.error === "Share not found" ? 404 : 403 }
      )
    }

    // Return updated share with URL
    const shareUrl = getShareUrl(result.share!.shareToken)

    return NextResponse.json({
      share: result.share,
      shareUrl,
    })
  } catch (error) {
    console.error("UPDATE_SHARE_ERROR", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// DELETE - Revoke/delete a share
export async function DELETE(request: NextRequest, { params }: { params: Promise<IParams> }) {
  try {
    // CSRF Protection
    if (!validateCsrf(request)) {
      return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 })
    }

    // Rate limiting
    const identifier = getClientIdentifier(request)
    const allowed = await Promise.resolve(shareLimiter.check(identifier))
    if (!allowed) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429 }
      )
    }

    const currentUser = await getCurrentUser()
    const { shareId } = await params

    if (!currentUser?.id || !currentUser?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Delete the share
    const result = await deleteShare(currentUser.id, shareId)

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: result.error === "Share not found" ? 404 : 403 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("DELETE_SHARE_ERROR", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
