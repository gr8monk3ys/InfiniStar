-- Add alternative AI reply variants for messages (regenerate / alt replies).

ALTER TABLE "messages" ADD COLUMN "variants" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "messages" ADD COLUMN "activeVariant" INTEGER NOT NULL DEFAULT 0;

