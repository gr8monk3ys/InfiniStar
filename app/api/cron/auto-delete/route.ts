import { NextResponse, type NextRequest } from "next/server"

import { runAutoDeleteForAllUsers } from "@/app/lib/auto-delete"
import { apiLogger } from "@/app/lib/logger"

const CRON_TIMEOUT_MS = 55_000

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

    // CRON_SECRET must always be set. Unauthenticated access is never permitted.
    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      apiLogger.warn("Unauthorized cron request attempt on /api/cron/auto-delete")
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Race the work against a 55s timeout to stay within Vercel's function limit
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("Cron timeout after 55s")), CRON_TIMEOUT_MS)
    )

    const result = await Promise.race([runAutoDeleteForAllUsers(), timeoutPromise])

    apiLogger.info(
      { processedUsers: result.processedUsers, totalDeleted: result.totalDeleted },
      "Auto-delete cron completed"
    )

    return NextResponse.json({
      success: true,
      processedUsers: result.processedUsers,
      totalDeleted: result.totalDeleted,
    })
  } catch (error: unknown) {
    const isTimeout = error instanceof Error && error.message.includes("Cron timeout")
    apiLogger.error(
      { err: error },
      isTimeout ? "Auto-delete cron timed out" : "Auto-delete cron failed"
    )
    return NextResponse.json(
      {
        error: isTimeout
          ? "Cron timed out — partial work may have completed"
          : "Internal server error",
      },
      { status: 500 }
    )
  }
}
