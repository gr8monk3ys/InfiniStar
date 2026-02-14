/**
 * Auto-Delete Run API Route
 *
 * POST /api/settings/auto-delete/run - Manually trigger the auto-delete cleanup
 *
 * This endpoint is rate-limited to once per hour to prevent abuse.
 */

import { NextResponse, type NextRequest } from "next/server"
import { auth } from "@clerk/nextjs/server"

import { deleteOldConversations, getAutoDeleteSettings } from "@/app/lib/auto-delete"
import { verifyCsrfToken } from "@/app/lib/csrf"
import prisma from "@/app/lib/prismadb"
import { getClientIdentifier, InMemoryRateLimiter } from "@/app/lib/rate-limit"

// Special rate limiter for auto-delete run: 1 request per hour
const autoDeleteRunLimiter = new InMemoryRateLimiter(1, 3600000) // 1 request per hour

// Cleanup old entries every hour
setInterval(() => {
  autoDeleteRunLimiter.cleanup()
}, 3600000)

/**
 * POST /api/settings/auto-delete/run
 * Manually trigger the auto-delete cleanup for the current user
 */
export async function POST(request: NextRequest) {
  try {
    // Special strict rate limiting for this endpoint
    const identifier = getClientIdentifier(request)
    const allowed = await Promise.resolve(autoDeleteRunLimiter.check(identifier))
    if (!allowed) {
      return NextResponse.json(
        {
          error: "You can only run auto-delete once per hour. Please try again later.",
        },
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

    // Check if auto-delete is enabled
    const settings = await getAutoDeleteSettings(currentUser.id)
    if (!settings.autoDeleteEnabled) {
      return NextResponse.json(
        { error: "Auto-delete is not enabled. Please enable it in settings first." },
        { status: 400 }
      )
    }

    // Run the auto-delete
    const result = await deleteOldConversations(currentUser.id)

    // Build response message
    let message: string
    if (result.deletedCount === 0) {
      message = "No conversations met the criteria for deletion."
    } else if (result.deletedCount === 1) {
      message = "Successfully deleted 1 conversation."
    } else {
      message = `Successfully deleted ${result.deletedCount} conversations.`
    }

    return NextResponse.json({
      success: true,
      message,
      result: {
        deletedCount: result.deletedCount,
        deletedConversationIds: result.deletedConversationIds,
        errors: result.errors,
      },
    })
  } catch (error) {
    console.error("Error running auto-delete:", error)
    return NextResponse.json({ error: "Failed to run auto-delete cleanup" }, { status: 500 })
  }
}
