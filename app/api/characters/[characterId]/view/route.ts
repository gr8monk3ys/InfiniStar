import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"

import { apiLogger } from "@/app/lib/logger"
import prisma from "@/app/lib/prismadb"
import { apiLimiter, getClientIdentifier } from "@/app/lib/rate-limit"

// View tracking is decoupled from the (now cached) page render. This endpoint is
// public (anonymous visitors must count) and intentionally requires no auth or CSRF.
// Rate limiting + a fire-once-per-mount client beacon keep counts honest.
const paramsSchema = z.object({ characterId: z.string().uuid() })

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ characterId: string }> }
): Promise<NextResponse> {
  const identifier = getClientIdentifier(request)
  const allowed = await Promise.resolve(apiLimiter.check(identifier))
  if (!allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 })
  }

  const parsed = paramsSchema.safeParse(await params)
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
