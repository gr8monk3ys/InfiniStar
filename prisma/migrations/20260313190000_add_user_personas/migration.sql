-- Create user_personas table
CREATE TABLE IF NOT EXISTS "user_personas" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "appearance" TEXT,
    "personalityTraits" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "userId" UUID NOT NULL,

    CONSTRAINT "user_personas_pkey" PRIMARY KEY ("id")
);

-- Add personaId to conversations
ALTER TABLE "conversations" ADD COLUMN IF NOT EXISTS "personaId" UUID;

-- Indexes
CREATE INDEX IF NOT EXISTS "user_personas_userId_idx" ON "user_personas"("userId");

-- Foreign keys
ALTER TABLE "user_personas" ADD CONSTRAINT "user_personas_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "conversations" ADD CONSTRAINT "conversations_personaId_fkey"
    FOREIGN KEY ("personaId") REFERENCES "user_personas"("id") ON DELETE SET NULL ON UPDATE CASCADE;
