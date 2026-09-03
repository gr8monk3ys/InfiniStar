-- Durable idempotency ledger for inbound provider webhooks (Stripe, Clerk, ...).
-- The Stripe webhook route claims an event by inserting here BEFORE running any
-- side effect; a concurrent retry loses the race with a unique-constraint
-- violation and is skipped.

-- CreateTable
CREATE TABLE "processed_webhook_events" (
    "id" UUID NOT NULL,
    "provider" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "processed_webhook_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "processed_webhook_events_processedAt_idx" ON "processed_webhook_events"("processedAt");

-- CreateIndex
CREATE UNIQUE INDEX "processed_webhook_events_provider_eventId_key" ON "processed_webhook_events"("provider", "eventId");
