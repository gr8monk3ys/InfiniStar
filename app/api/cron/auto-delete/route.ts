import { NextResponse, type NextRequest } from "next/server"

import { runAutoDeleteForAllUsers } from "@/app/lib/auto-delete"

/**
 * GET /api/cron/auto-delete - Process auto-delete for all users
 *
 * This endpoint should be called by a cron job to process auto-delete
 * for all users who have the feature enabled.
 *
 * Security: Protected by CRON_SECRET environment variable.
 *
 * Vercel Cron Configuration (vercel.json):
 * {
 *   "crons": [{
 *     "path": "/api/cron/auto-delete",
 *     "schedule": "0 3 * * *"
 *   }]
 * }
 */
export async function GET(request: NextRequest) {
  try {
    // Verify the request is from our cron job
    const authHeader = request.headers.get("authorization")
    const cronSecret = process.env.CRON_SECRET

    // In production, always require the cron secret
    if (process.env.NODE_ENV === "production") {
      if (!cronSecret) {
        console.error("[CRON] CRON_SECRET environment variable not set")
        return NextResponse.json({ error: "Server configuration error" }, { status: 500 })
      }

      if (authHeader !== `Bearer ${cronSecret}`) {
        console.warn("[CRON] Unauthorized cron request attempt")
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
      }
    }

    // Run auto-delete for all users
    const result = await runAutoDeleteForAllUsers()

    console.warn(
      `[CRON] Auto-delete processed for ${result.processedUsers} users, ${result.totalDeleted} conversations deleted`
    )

    return NextResponse.json({
      success: true,
      processedUsers: result.processedUsers,
      totalDeleted: result.totalDeleted,
    })
  } catch (error: unknown) {
    console.error("[CRON] Error processing auto-delete:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
