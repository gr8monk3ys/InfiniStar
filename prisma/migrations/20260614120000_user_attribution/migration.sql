-- Slice A3: first-touch attribution columns + self-referral relation on users

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "referralSource" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "utmSource" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "utmMedium" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "utmCampaign" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "firstTouchAt" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "referredById" UUID;

-- Indexes
CREATE INDEX IF NOT EXISTS "users_referredById_idx" ON "users"("referredById");
CREATE INDEX IF NOT EXISTS "users_utmSource_createdAt_idx" ON "users"("utmSource", "createdAt");

-- Self-referral FK (SET NULL so deleting a referrer never cascades into referred users)
ALTER TABLE "users" ADD CONSTRAINT "users_referredById_fkey"
    FOREIGN KEY ("referredById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
