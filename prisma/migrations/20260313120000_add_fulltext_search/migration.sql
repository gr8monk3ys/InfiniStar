-- Add tsvector columns for full-text search
ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "search_vector" tsvector;
ALTER TABLE "conversations" ADD COLUMN IF NOT EXISTS "name_search_vector" tsvector;

-- Create GIN indexes for fast full-text search
CREATE INDEX IF NOT EXISTS "messages_search_vector_idx" ON "messages" USING GIN ("search_vector");
CREATE INDEX IF NOT EXISTS "conversations_name_search_vector_idx" ON "conversations" USING GIN ("name_search_vector");

-- Trigger function to auto-update messages.search_vector on INSERT/UPDATE
CREATE OR REPLACE FUNCTION messages_search_vector_update() RETURNS trigger AS $$
BEGIN
  NEW.search_vector := to_tsvector('english', COALESCE(NEW.body, ''));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger function to auto-update conversations.name_search_vector on INSERT/UPDATE
CREATE OR REPLACE FUNCTION conversations_name_search_vector_update() RETURNS trigger AS $$
BEGIN
  NEW.name_search_vector := to_tsvector('english', COALESCE(NEW.name, ''));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers
DROP TRIGGER IF EXISTS messages_search_vector_trigger ON "messages";
CREATE TRIGGER messages_search_vector_trigger
  BEFORE INSERT OR UPDATE OF "body" ON "messages"
  FOR EACH ROW
  EXECUTE FUNCTION messages_search_vector_update();

DROP TRIGGER IF EXISTS conversations_name_search_vector_trigger ON "conversations";
CREATE TRIGGER conversations_name_search_vector_trigger
  BEFORE INSERT OR UPDATE OF "name" ON "conversations"
  FOR EACH ROW
  EXECUTE FUNCTION conversations_name_search_vector_update();

-- Backfill existing data
UPDATE "messages" SET "search_vector" = to_tsvector('english', COALESCE("body", ''))
  WHERE "search_vector" IS NULL;
UPDATE "conversations" SET "name_search_vector" = to_tsvector('english', COALESCE("name", ''))
  WHERE "name_search_vector" IS NULL;
