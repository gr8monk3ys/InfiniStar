import { cache } from "react"
import { cookies } from "next/headers"
import { after } from "next/server"

import { ATTRIBUTION_COOKIE_NAME } from "@/app/lib/attribution"
import { persistAttributionForUser } from "@/app/lib/attribution-persist"
import { getAuthSession } from "@/app/lib/auth"
import prisma from "@/app/lib/prismadb"

const slimSelect = {
  id: true,
  email: true,
  name: true,
  image: true,
  clerkId: true,
  stripePriceId: true,
  stripeCurrentPeriodEnd: true,
  isAdult: true,
  nsfwEnabled: true,
  adultConfirmedAt: true,
} as const

export type SlimUser = NonNullable<Awaited<ReturnType<typeof getCurrentUserSlim>>>

/**
 * Wrapped in `React.cache` so every server component in one render shares a
 * single auth + user lookup. A conversation page reached the viewer through the
 * page, the conversations layout, `getConversations` and `getConversationById`
 * — four identical round trips per request before this. Outside a React render
 * (route handlers, tests) `cache` is a pass-through.
 */
export const getCurrentUserSlim = cache(async () => {
  try {
    const session = await getAuthSession()
    if (!session?.user?.id) {
      return null
    }

    return prisma.user.findUnique({
      where: { id: session.user.id },
      select: slimSelect,
    })
  } catch {
    return null
  }
})

/**
 * Schedules work to run after the response is sent. `after` needs a request
 * scope; where there is none (a test, a script) the work still runs, just not
 * deferred. The attribution write is best-effort and never throws.
 */
function runAfterResponse(task: () => Promise<void>) {
  try {
    after(task)
  } catch {
    void task()
  }
}

const getCurrentUser = cache(async () => {
  try {
    const session = await getAuthSession()
    if (!session?.user?.id) {
      return null
    }

    const user = await prisma.user.findUnique({
      where: {
        id: session.user.id,
      },
      // Never hand the password hash to API routes — callers that legitimately
      // need it (fallback sign-in, backup-password changes) query it directly.
      omit: {
        hashedPassword: true,
      },
    })

    if (user) {
      // First-authenticated-request enrichment: capture first-touch attribution
      // from the visitor cookie and fire signup_completed. Deferred until after
      // the response so it neither delays the request nor is dropped when a
      // serverless instance freezes on a bare fire-and-forget promise.
      const cookieStore = await cookies()
      const rawAttribution = cookieStore.get(ATTRIBUTION_COOKIE_NAME)?.value
      const attributionRow = {
        id: user.id,
        utmSource: user.utmSource,
        utmMedium: user.utmMedium,
        utmCampaign: user.utmCampaign,
        referralSource: user.referralSource,
        firstTouchAt: user.firstTouchAt,
      }
      runAfterResponse(() => persistAttributionForUser(attributionRow, rawAttribution))
    }

    return user
  } catch {
    return null
  }
})

export default getCurrentUser
