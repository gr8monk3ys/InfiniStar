import { NextResponse, type NextRequest } from "next/server"

import { dbLogger } from "@/app/lib/logger"
import prisma from "@/app/lib/prismadb"

/**
 * GET /api/cron/reconcile-character-comment-counts
 *
 * Recomputes Character.commentCount from CharacterComment rows to fix drift.
 *
 * Security: Protected by CRON_SECRET environment variable.
 */
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization")
    const cronSecret = process.env.CRON_SECRET

    if (!cronSecret) {
      dbLogger.error("CRON_SECRET environment variable not set")
      return NextResponse.json({ error: "Server configuration error" }, { status: 500 })
    }

    if (authHeader !== `Bearer ${cronSecret}`) {
      dbLogger.warn("Unauthorized cron request attempt")
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const updatedRows = await prisma.$executeRaw`
      UPDATE "characters" AS c
      SET "commentCount" = (
        SELECT COUNT(*)
        FROM "character_comments" AS cc
        WHERE cc."characterId" = c."id"
      )
    `

    return NextResponse.json({ success: true, updatedRows })
  } catch (error: unknown) {
    dbLogger.error({ err: error }, "Error reconciling character comment counts")
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
