import { NextResponse } from "next/server"
import { z } from "zod"

import { guard } from "@/app/lib/guarded-route"
import { apiLogger } from "@/app/lib/logger"
import prisma from "@/app/lib/prismadb"
import { apiLimiter } from "@/app/lib/rate-limit"

const paramsSchema = z.object({ characterId: z.string().uuid() })

/**
 * POST /api/characters/[characterId]/view
 *
 * View tracking is decoupled from the (now cached) page render, and anonymous
 * visitors must count — hence `auth: "none"`, deliberately absent rather than
 * missing.
 *
 * `csrf: false` is also deliberate. CSRF defends against an attacker spending a
 * victim's ambient credentials; this endpoint takes none and its only effect is
 * incrementing a public counter, so there is nothing to forge. Anyone wanting
 * to inflate a count can fetch a token themselves. The double-submit check
 * would buy nothing and cost every cold page load an extra round trip to
 * /api/csrf, with view counting failing silently whenever that request did.
 * The rate limiter is the control that actually bounds abuse here.
 */
export const POST = guard<undefined, { characterId: string }>(
  { auth: "none", csrf: false, limiter: apiLimiter },
  async ({ params }) => {
    const parsed = paramsSchema.safeParse(params)
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid character id" }, { status: 400 })
    }

    try {
      await prisma.character.update({
        where: { id: parsed.data.characterId },
        data: { viewCount: { increment: 1 } },
      })
    } catch (error) {
      // Fire-and-forget: a missing/unpublished character or transient DB error must never
      // surface to the beacon caller. Log and respond 200 so the client does not retry.
      apiLogger.warn({ err: error, characterId: parsed.data.characterId }, "View increment skipped")
    }

    return NextResponse.json({ ok: true })
  }
)
