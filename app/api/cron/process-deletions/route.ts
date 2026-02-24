import { NextResponse, type NextRequest } from "next/server"

import { getDeletionStats, processScheduledDeletions } from "@/app/lib/account-deletion"
import { apiLogger } from "@/app/lib/logger"

/**
 * GET /api/cron/process-deletions - Process scheduled account deletions
 *
 * This endpoint should be called by a cron job to process accounts
 * whose deletion grace period has expired.
 *
 * Security: Protected by CRON_SECRET environment variable.
 *
 * Vercel Cron Configuration (vercel.json):
 * {
 *   "crons": [{
 *     "path": "/api/cron/process-deletions",
 *     "schedule": "0 2 * * *"
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
      apiLogger.warn("Unauthorized cron request attempt on /api/cron/process-deletions")
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Get current stats before processing
    const statsBefore = await getDeletionStats()

    // Process all scheduled deletions
    const result = await processScheduledDeletions()

    // Get stats after processing
    const statsAfter = await getDeletionStats()

    apiLogger.info(
      {
        processed: result.processed,
        failed: result.failed,
        remainingPending: statsAfter.pendingDeletions,
        remainingOverdue: statsAfter.overdueForDeletion,
      },
      "Account deletion cron completed"
    )

    return NextResponse.json({
      success: true,
      processed: result.processed,
      failed: result.failed,
      errors: result.errors.length > 0 ? result.errors : undefined,
      stats: {
        before: statsBefore,
        after: statsAfter,
      },
    })
  } catch (error: unknown) {
    apiLogger.error({ err: error }, "Account deletion cron failed")
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
