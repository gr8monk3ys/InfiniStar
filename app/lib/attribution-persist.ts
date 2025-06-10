import { captureServerEvent } from "@/app/lib/analytics"
import { parseAttributionCookie, resolveAttribution } from "@/app/lib/attribution"
import { authLogger } from "@/app/lib/logger"
import prisma from "@/app/lib/prismadb"

export interface UserAttributionRow {
  id: string
  utmSource: string | null
  utmMedium: string | null
  utmCampaign: string | null
  referralSource: string | null
  firstTouchAt: Date | null
}

/**
 * First-authenticated-request enrichment. Reads the visitor's `ist_attribution`
 * cookie, and if the user is not yet attributed, persists the first-touch source
 * and fires the server-side `signup_completed` event WITH the resolved source.
 *
 * Fire-and-forget: this never throws into the caller. It is safe to `void` from
 * `getCurrentUser`.
 */
export async function persistAttributionForUser(
  user: UserAttributionRow,
  rawCookie: string | undefined | null
): Promise<void> {
  try {
    const cookie = parseAttributionCookie(rawCookie ?? null)
    const data = resolveAttribution(cookie, {
      utmSource: user.utmSource,
      utmMedium: user.utmMedium,
      utmCampaign: user.utmCampaign,
      referralSource: user.referralSource,
      firstTouchAt: user.firstTouchAt,
    })

    if (Object.keys(data).length === 0) {
      return
    }

    await prisma.user.update({
      where: { id: user.id },
      data,
    })

    captureServerEvent(user.id, "signup_completed", {
      utmSource: data.utmSource,
      utmMedium: data.utmMedium,
      utmCampaign: data.utmCampaign,
      referralSource: data.referralSource,
    })
  } catch (error) {
    // Attribution is best-effort — never break the authenticated request path.
    authLogger.warn({ err: error, userId: user.id }, "Failed to persist attribution")
  }
}
