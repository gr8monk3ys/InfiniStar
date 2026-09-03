import prisma from "@/app/lib/prismadb"

/**
 * How long a processed-webhook claim is worth keeping.
 *
 * The claim exists to make a provider's retries idempotent, so it only has to
 * outlive the provider's retry window. Stripe gives up after 3 days; 30 gives
 * a wide margin and keeps the table small enough to stay uninteresting.
 *
 * This replaces the 48h TTL that the previous Redis-backed guard got for free.
 * A durable ledger does not expire on its own, so something has to prune it.
 */
export const WEBHOOK_EVENT_RETENTION_DAYS = 30

/**
 * Deletes processed-webhook claims older than the retention window.
 *
 * Safe to run concurrently with live webhook traffic: it only touches rows
 * whose retry window has long closed, so it can never delete a claim that a
 * retry is still racing against.
 */
export async function pruneProcessedWebhookEvents(
  retentionDays: number = WEBHOOK_EVENT_RETENTION_DAYS
): Promise<{ deleted: number; olderThan: Date }> {
  const olderThan = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000)

  const { count } = await prisma.processedWebhookEvent.deleteMany({
    where: { processedAt: { lt: olderThan } },
  })

  return { deleted: count, olderThan }
}
