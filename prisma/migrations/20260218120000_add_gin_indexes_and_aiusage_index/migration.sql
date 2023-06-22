-- AddGinIndex for archivedBy, pinnedBy, mutedBy on conversations
CREATE INDEX IF NOT EXISTS "conversations_archivedBy_idx" ON "conversations" USING GIN ("archivedBy");
CREATE INDEX IF NOT EXISTS "conversations_pinnedBy_idx" ON "conversations" USING GIN ("pinnedBy");
CREATE INDEX IF NOT EXISTS "conversations_mutedBy_idx" ON "conversations" USING GIN ("mutedBy");

-- AddIndex for AiUsage (userId, createdAt)
CREATE INDEX IF NOT EXISTS "ai_usage_userId_createdAt_idx" ON "ai_usage" ("userId", "createdAt");
