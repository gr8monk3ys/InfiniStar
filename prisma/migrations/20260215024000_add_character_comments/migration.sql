-- Character comments + per-character comment counter.

ALTER TABLE "characters" ADD COLUMN "commentCount" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "character_comments" (
    "id" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "body" TEXT NOT NULL,
    "characterId" UUID NOT NULL,
    "authorId" UUID NOT NULL,

    CONSTRAINT "character_comments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "character_comments_characterId_createdAt_idx" ON "character_comments"("characterId", "createdAt");

-- CreateIndex
CREATE INDEX "character_comments_authorId_createdAt_idx" ON "character_comments"("authorId", "createdAt");

-- AddForeignKey
ALTER TABLE "character_comments" ADD CONSTRAINT "character_comments_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "characters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "character_comments" ADD CONSTRAINT "character_comments_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

