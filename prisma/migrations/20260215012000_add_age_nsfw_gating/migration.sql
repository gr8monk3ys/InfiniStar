-- Age gating + NSFW preferences + character NSFW flag.

ALTER TABLE "users" ADD COLUMN "isAdult" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN "adultConfirmedAt" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN "nsfwEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN "nsfwEnabledAt" TIMESTAMP(3);

ALTER TABLE "characters" ADD COLUMN "isNsfw" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "characters_isPublic_isNsfw_idx" ON "characters"("isPublic", "isNsfw");

