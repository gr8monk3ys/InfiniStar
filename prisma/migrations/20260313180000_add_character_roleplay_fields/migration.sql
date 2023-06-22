-- Add roleplay quality fields to characters
ALTER TABLE "characters" ADD COLUMN IF NOT EXISTS "scenario" TEXT;
ALTER TABLE "characters" ADD COLUMN IF NOT EXISTS "example_dialogues" TEXT;
