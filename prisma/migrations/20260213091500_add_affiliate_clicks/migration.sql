-- CreateTable
CREATE TABLE "affiliate_clicks" (
    "id" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "partnerId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "destinationUrl" TEXT NOT NULL,
    "destinationHost" TEXT NOT NULL,
    "referrer" TEXT,
    "userAgent" TEXT,
    "clientIp" TEXT,

    CONSTRAINT "affiliate_clicks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "affiliate_clicks_createdAt_idx" ON "affiliate_clicks"("createdAt");

-- CreateIndex
CREATE INDEX "affiliate_clicks_partnerId_createdAt_idx" ON "affiliate_clicks"("partnerId", "createdAt");

-- CreateIndex
CREATE INDEX "affiliate_clicks_source_createdAt_idx" ON "affiliate_clicks"("source", "createdAt");

-- CreateIndex
CREATE INDEX "affiliate_clicks_destinationHost_createdAt_idx" ON "affiliate_clicks"("destinationHost", "createdAt");
