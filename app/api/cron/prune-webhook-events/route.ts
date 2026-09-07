import { NextResponse, type NextRequest } from "next/server"

import { guard } from "@/app/lib/guarded-route"
import { apiLogger } from "@/app/lib/logger"
import { pruneProcessedWebhookEvents, WEBHOOK_EVENT_RETENTION_DAYS } from "@/app/lib/webhook-events"

const CRON_TIMEOUT_MS = 55_000

/**
 * GET /api/cron/prune-webhook-events - Trim the processed-webhook ledger.
 *
 * The Stripe webhook claims each event in `processed_webhook_events` before
 * running any side effect, which is what makes retries idempotent without
 * Redis. A durable ledger does not expire on its own, so this prunes claims
 * older than the retention window.
 *
 * Security: Protected by the CRON_SECRET environment variable.
 *
 * Scheduled in vercel.json at 05:00 daily, after the other three crons.
 */
export const GET = guard({ auth: "cron" }, async () => {
  try {
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("Cron timeout after 55s")), CRON_TIMEOUT_MS)
    )

    const result = await Promise.race([pruneProcessedWebhookEvents(), timeoutPromise])

    apiLogger.info(
      { deleted: result.deleted, olderThan: result.olderThan.toISOString() },
      "Webhook event prune completed"
    )

    return NextResponse.json({
      success: true,
      deleted: result.deleted,
      retentionDays: WEBHOOK_EVENT_RETENTION_DAYS,
    })
  } catch (error: unknown) {
    const isTimeout = error instanceof Error && error.message.includes("Cron timeout")
    apiLogger.error(
      { err: error },
      isTimeout ? "Webhook event prune timed out" : "Webhook event prune failed"
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
})
