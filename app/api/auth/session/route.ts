import { NextResponse, type NextRequest } from "next/server"

import { getAuthSession } from "@/app/lib/auth"
import { matureAccess } from "@/app/lib/nsfw"
import prisma from "@/app/lib/prismadb"
import { apiLimiter, getClientIdentifier } from "@/app/lib/rate-limit"
import { EMPTY_VIEWER, type SessionViewer } from "@/app/lib/session-viewer"
import { isProSubscription } from "@/app/lib/subscription"

/**
 * The per-viewer facts prerendered pages resolve after hydration. One slim
 * lookup by id — the session resolver already proved the user exists — so a
 * cached character, creator or pricing page costs one round trip here instead
 * of a cold render with several.
 */
async function resolveViewer(userId: string): Promise<SessionViewer> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      isAdult: true,
      nsfwEnabled: true,
      adultConfirmedAt: true,
      stripePriceId: true,
      stripeCurrentPeriodEnd: true,
    },
  })

  if (!user) {
    return EMPTY_VIEWER
  }

  return {
    canViewMature: matureAccess(user).canView,
    isPro: isProSubscription(user),
  }
}

export async function GET(request: NextRequest) {
  const identifier = getClientIdentifier(request)
  const allowed = await Promise.resolve(apiLimiter.check(identifier))
  if (!allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 })
  }

  const session = await getAuthSession()
  const viewer = session
    ? await resolveViewer(session.user.id).catch(() => EMPTY_VIEWER)
    : EMPTY_VIEWER

  return NextResponse.json(
    {
      authMode: session?.authMode ?? null,
      isSignedIn: Boolean(session),
      user: session?.user ?? null,
      viewer,
    },
    // Per-user; never let a CDN or the browser cache it across visitors.
    { headers: { "Cache-Control": "private, no-store" } }
  )
}
