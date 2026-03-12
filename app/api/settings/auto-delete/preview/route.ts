/**
 * Auto-Delete Preview API Route
 *
 * POST /api/settings/auto-delete/preview - Preview what would be deleted
 */

import { NextResponse, type NextRequest } from "next/server"

import { getAutoDeletePreview } from "@/app/lib/auto-delete"
import { getCsrfTokenFromRequest, verifyCsrfToken } from "@/app/lib/csrf"
import { apiLimiter, getClientIdentifier } from "@/app/lib/rate-limit"
import getCurrentUser from "@/app/actions/getCurrentUser"

/**
 * POST /api/settings/auto-delete/preview
 * Get a preview of conversations that would be deleted
 */
export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const identifier = getClientIdentifier(request)
    const allowed = await Promise.resolve(apiLimiter.check(identifier))
    if (!allowed) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429 }
      )
    }

    // CSRF Protection
    const headerToken = request.headers.get("X-CSRF-Token")
    const cookieToken = getCsrfTokenFromRequest(request)

    if (!verifyCsrfToken(headerToken, cookieToken)) {
      return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 })
    }

    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json({ error: "User not found" }, { status: 401 })
    }

    const preview = await getAutoDeletePreview(currentUser.id)

    return NextResponse.json({
      preview: {
        conversations: preview.conversations,
        totalCount: preview.totalCount,
        settings: preview.settings,
      },
    })
  } catch (error) {
    console.error("Error generating auto-delete preview:", error)
    return NextResponse.json({ error: "Failed to generate auto-delete preview" }, { status: 500 })
  }
}
