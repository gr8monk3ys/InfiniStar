-- Repairs migration history so `prisma migrate deploy` can build the database
-- from scratch.
--
-- The `characters`, `character_likes`, `content_reports`, and `user_blocks`
-- tables (plus the moderation enums and `conversations.characterId`) only ever
-- reached deployed databases through `prisma db push`; no migration created
-- them. As a result `migrate deploy` failed on a fresh database at
-- 20260215012000_add_age_nsfw_gating, which does
-- `ALTER TABLE "characters" ADD COLUMN "isNsfw"` on a table that did not exist.
--
-- This migration is dated to sort immediately after the init migration so the
-- later ALTERs apply naturally. Columns those later migrations add
-- (`isNsfw`, `commentCount`, `scenario`, `example_dialogues`) are deliberately
-- NOT created here.
--
-- Every statement is guarded so this is a no-op on databases that already have
-- these objects from `db push`.

-- Moderation enums
DO $$ BEGIN
  CREATE TYPE "ReportTargetType" AS ENUM ('USER', 'MESSAGE', 'CONVERSATION', 'CHARACTER');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "ReportReason" AS ENUM ('HARASSMENT', 'HATE', 'SEXUAL', 'VIOLENCE', 'SPAM', 'COPYRIGHT', 'OTHER');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "ReportStatus" AS ENUM ('OPEN', 'REVIEWING', 'RESOLVED', 'DISMISSED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Characters
CREATE TABLE IF NOT EXISTS "characters" (
    "id" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "tagline" TEXT,
    "description" TEXT,
    "greeting" TEXT,
    "systemPrompt" TEXT NOT NULL,
    "avatarUrl" TEXT,
    "coverImageUrl" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "lastUsedAt" TIMESTAMP(3),
    "category" TEXT NOT NULL DEFAULT 'general',
    "likeCount" INTEGER NOT NULL DEFAULT 0,
    "createdById" UUID NOT NULL,

    CONSTRAINT "characters_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "characters_slug_key" ON "characters"("slug");
CREATE INDEX IF NOT EXISTS "characters_isPublic_featured_idx" ON "characters"("isPublic", "featured");
CREATE INDEX IF NOT EXISTS "characters_createdAt_idx" ON "characters"("createdAt");
CREATE INDEX IF NOT EXISTS "characters_usageCount_idx" ON "characters"("usageCount");

-- Character likes
CREATE TABLE IF NOT EXISTS "character_likes" (
    "id" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" UUID NOT NULL,
    "characterId" UUID NOT NULL,

    CONSTRAINT "character_likes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "character_likes_userId_characterId_key" ON "character_likes"("userId", "characterId");
CREATE INDEX IF NOT EXISTS "character_likes_characterId_idx" ON "character_likes"("characterId");
CREATE INDEX IF NOT EXISTS "character_likes_userId_idx" ON "character_likes"("userId");

-- Content reports
CREATE TABLE IF NOT EXISTS "content_reports" (
    "id" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "reporterId" UUID NOT NULL,
    "targetType" "ReportTargetType" NOT NULL,
    "targetId" TEXT NOT NULL,
    "reason" "ReportReason" NOT NULL,
    "details" TEXT,
    "status" "ReportStatus" NOT NULL DEFAULT 'OPEN',
    "resolvedAt" TIMESTAMP(3),
    "resolvedBy" TEXT,

    CONSTRAINT "content_reports_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "content_reports_reporterId_idx" ON "content_reports"("reporterId");
CREATE INDEX IF NOT EXISTS "content_reports_targetType_targetId_idx" ON "content_reports"("targetType", "targetId");
CREATE INDEX IF NOT EXISTS "content_reports_status_idx" ON "content_reports"("status");

-- User blocks
CREATE TABLE IF NOT EXISTS "user_blocks" (
    "id" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reason" TEXT,
    "blockerId" UUID NOT NULL,
    "blockedId" UUID NOT NULL,

    CONSTRAINT "user_blocks_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "user_blocks_blockerId_blockedId_key" ON "user_blocks"("blockerId", "blockedId");
CREATE INDEX IF NOT EXISTS "user_blocks_blockerId_idx" ON "user_blocks"("blockerId");
CREATE INDEX IF NOT EXISTS "user_blocks_blockedId_idx" ON "user_blocks"("blockedId");

-- Conversations -> characters link
ALTER TABLE "conversations" ADD COLUMN IF NOT EXISTS "characterId" UUID;
CREATE INDEX IF NOT EXISTS "conversations_characterId_idx" ON "conversations"("characterId");

-- Foreign keys
DO $$ BEGIN
  ALTER TABLE "characters" ADD CONSTRAINT "characters_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "character_likes" ADD CONSTRAINT "character_likes_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "character_likes" ADD CONSTRAINT "character_likes_characterId_fkey"
    FOREIGN KEY ("characterId") REFERENCES "characters"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "content_reports" ADD CONSTRAINT "content_reports_reporterId_fkey"
    FOREIGN KEY ("reporterId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "user_blocks" ADD CONSTRAINT "user_blocks_blockerId_fkey"
    FOREIGN KEY ("blockerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "user_blocks" ADD CONSTRAINT "user_blocks_blockedId_fkey"
    FOREIGN KEY ("blockedId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "conversations" ADD CONSTRAINT "conversations_characterId_fkey"
    FOREIGN KEY ("characterId") REFERENCES "characters"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
