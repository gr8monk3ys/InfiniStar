/**
 * Auto-Delete Preview API Route
 *
 * POST /api/settings/auto-delete/preview - Preview what would be deleted
 */

import { NextResponse, type NextRequest } from "next/server"
import { auth } from "@clerk/nextjs/server"

import { getAutoDeletePreview } from "@/app/lib/auto-delete"
import { verifyCsrfToken } from "@/app/lib/csrf"
import prisma from "@/app/lib/prismadb"
import { apiLimiter, getClientIdentifier } from "@/app/lib/rate-limit"

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

    if (!verifyCsrfToken(headerToken, cookieToken)) {
      return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 })
    }

    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const currentUser = await prisma.user.findUnique({
      where: { clerkId: userId },
      select: { id: true },
    })
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
