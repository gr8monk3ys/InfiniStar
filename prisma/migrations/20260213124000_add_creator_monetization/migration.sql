-- CreateEnum
CREATE TYPE "CreatorTransactionStatus" AS ENUM ('COMPLETED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "CreatorSubscriptionInterval" AS ENUM ('MONTHLY', 'YEARLY');

-- CreateEnum
CREATE TYPE "CreatorSubscriptionStatus" AS ENUM ('ACTIVE', 'CANCELED', 'PAUSED');

-- CreateTable
CREATE TABLE "creator_tips" (
    "id" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "supporterId" UUID NOT NULL,
    "creatorId" UUID NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "note" TEXT,
    "status" "CreatorTransactionStatus" NOT NULL DEFAULT 'COMPLETED',

    CONSTRAINT "creator_tips_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "creator_subscriptions" (
    "id" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "supporterId" UUID NOT NULL,
    "creatorId" UUID NOT NULL,
    "tierName" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "interval" "CreatorSubscriptionInterval" NOT NULL DEFAULT 'MONTHLY',
    "status" "CreatorSubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "canceledAt" TIMESTAMP(3),

    CONSTRAINT "creator_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "creator_tips_creatorId_createdAt_idx" ON "creator_tips"("creatorId", "createdAt");

-- CreateIndex
CREATE INDEX "creator_tips_supporterId_createdAt_idx" ON "creator_tips"("supporterId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "creator_subscriptions_supporterId_creatorId_key" ON "creator_subscriptions"("supporterId", "creatorId");

-- CreateIndex
CREATE INDEX "creator_subscriptions_creatorId_status_idx" ON "creator_subscriptions"("creatorId", "status");

-- CreateIndex
CREATE INDEX "creator_subscriptions_supporterId_status_idx" ON "creator_subscriptions"("supporterId", "status");

-- AddForeignKey
ALTER TABLE "creator_tips" ADD CONSTRAINT "creator_tips_supporterId_fkey" FOREIGN KEY ("supporterId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "creator_tips" ADD CONSTRAINT "creator_tips_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "creator_subscriptions" ADD CONSTRAINT "creator_subscriptions_supporterId_fkey" FOREIGN KEY ("supporterId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "creator_subscriptions" ADD CONSTRAINT "creator_subscriptions_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
