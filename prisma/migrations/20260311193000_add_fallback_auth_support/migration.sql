ALTER TABLE "users"
ADD COLUMN IF NOT EXISTS "clerkId" TEXT;

ALTER TABLE "users"
ADD COLUMN IF NOT EXISTS "hashedPassword" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'users_clerkId_key'
  ) THEN
    CREATE UNIQUE INDEX "users_clerkId_key" ON "users"("clerkId");
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "user_sessions" (
  "id" UUID NOT NULL,
  "sessionToken" TEXT NOT NULL,
  "userId" UUID NOT NULL,
  "deviceType" TEXT,
  "browser" TEXT,
  "os" TEXT,
  "ipAddress" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastActiveAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "isRevoked" BOOLEAN NOT NULL DEFAULT false,
  "revokedAt" TIMESTAMP(3),

  CONSTRAINT "user_sessions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "user_sessions_sessionToken_key"
ON "user_sessions"("sessionToken");

CREATE INDEX IF NOT EXISTS "user_sessions_userId_idx"
ON "user_sessions"("userId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'user_sessions_userId_fkey'
  ) THEN
    ALTER TABLE "user_sessions"
    ADD CONSTRAINT "user_sessions_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
