import { NextResponse, type NextRequest } from "next/server"

import { guard } from "@/app/lib/guarded-route"
import { dbLogger } from "@/app/lib/logger"
import prisma from "@/app/lib/prismadb"

/**
 * GET /api/cron/reconcile-character-comment-counts
 *
 * Recomputes Character.commentCount from CharacterComment rows to fix drift.
 *
 * Security: Protected by CRON_SECRET environment variable.
 */
export const GET = guard({ auth: "cron" }, async () => {
  try {
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
})
