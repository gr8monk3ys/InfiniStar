/**
 * Auto-Delete Settings API Routes
 *
 * GET /api/settings/auto-delete - Get current auto-delete settings
 * PATCH /api/settings/auto-delete - Update auto-delete settings
 */

import { NextResponse, type NextRequest } from "next/server"
import { getServerSession } from "next-auth"
import { z } from "zod"

import { authOptions } from "@/app/lib/auth"
import {
  getAutoDeleteSettings,
  RETENTION_PERIODS,
  updateAutoDeleteSettings,
} from "@/app/lib/auto-delete"
import { verifyCsrfToken } from "@/app/lib/csrf"
import { apiLimiter, getClientIdentifier } from "@/app/lib/rate-limit"

// Validation schema for updating auto-delete settings
const updateSettingsSchema = z.object({
  autoDeleteEnabled: z.boolean().optional(),
  autoDeleteAfterDays: z
    .number()
    .refine((val) => RETENTION_PERIODS.includes(val as 7 | 14 | 30 | 60 | 90 | 180 | 365), {
      message: "Invalid retention period. Must be 7, 14, 30, 60, 90, 180, or 365 days.",
    })
    .optional(),
  autoDeleteArchived: z.boolean().optional(),
  autoDeleteExcludeTags: z.array(z.string()).optional(),
})

/**
 * GET /api/settings/auto-delete
 * Get current auto-delete settings for the user
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    const currentUser = session?.user

    if (!currentUser?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const settings = await getAutoDeleteSettings(currentUser.id)

    return NextResponse.json({ settings })
  } catch (error) {
    console.error("Error fetching auto-delete settings:", error)
    return NextResponse.json({ error: "Failed to fetch auto-delete settings" }, { status: 500 })
  }
}

/**
 * PATCH /api/settings/auto-delete
 * Update auto-delete settings for the user
 */
export async function PATCH(request: NextRequest) {
  try {
    // Rate limiting
    const identifier = getClientIdentifier(request)
    if (!apiLimiter.check(identifier)) {
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

    const session = await getServerSession(authOptions)
    const currentUser = session?.user

    if (!currentUser?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()

    // Validate input
    const validationResult = updateSettingsSchema.safeParse(body)
    if (!validationResult.success) {
      return NextResponse.json({ error: validationResult.error.issues[0].message }, { status: 400 })
    }

    const updatedSettings = await updateAutoDeleteSettings(currentUser.id, validationResult.data)

    return NextResponse.json({
      message: "Auto-delete settings updated successfully",
      settings: updatedSettings,
    })
  } catch (error) {
    console.error("Error updating auto-delete settings:", error)
    return NextResponse.json({ error: "Failed to update auto-delete settings" }, { status: 500 })
  }
}
