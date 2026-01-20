import { NextResponse, type NextRequest } from "next/server"

import { getDeletionStats, processScheduledDeletions } from "@/app/lib/account-deletion"

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

    // In production, always require the cron secret
    if (process.env.NODE_ENV === "production") {
      if (!cronSecret) {
        // eslint-disable-next-line no-console -- Security logging
        console.error("[CRON] CRON_SECRET environment variable not set")
        return NextResponse.json({ error: "Server configuration error" }, { status: 500 })
      }

      if (authHeader !== `Bearer ${cronSecret}`) {
        // eslint-disable-next-line no-console -- Security logging
        console.warn("[CRON] Unauthorized cron request attempt")
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
      }
    }

    // Get current stats before processing
    const statsBefore = await getDeletionStats()

    // Process all scheduled deletions
    const result = await processScheduledDeletions()

    // Get stats after processing
    const statsAfter = await getDeletionStats()

    // eslint-disable-next-line no-console -- Audit logging
    console.log(
      `[CRON] Processed ${result.processed} deletions, ${result.failed} failed. ` +
        `Remaining: ${statsAfter.pendingDeletions} pending, ${statsAfter.overdueForDeletion} overdue.`
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
    // eslint-disable-next-line no-console -- Error logging
    console.error("[CRON] Error processing deletions:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
