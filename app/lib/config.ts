/**
 * One answer per configuration question.
 *
 * `env.mjs` declares the schema but almost nothing imports it: 96 raw
 * `process.env` reads sit across 52 files, and each invents its own fallback.
 * Where a variable is read in more than one place those fallbacks had drifted,
 * so the same deploy could answer the same question differently depending on
 * which module asked.
 *
 * Deliberately not `env.mjs` itself: `cors.ts` is reached from `middleware.ts`,
 * which runs on the edge, and pulling the whole validator into that bundle to
 * read one string is a poor trade.
 *
 * Getter properties, not constants, so the values are re-read on each access.
 * That preserves the behaviour of the inline reads this replaced, and keeps
 * them overridable in tests — the same pattern as `monetizationConfig`.
 */

const DEV_APP_URL = "http://localhost:3000"

function warnIfMissingInProduction(name: string, value: string | undefined, fallback: string) {
  if (value) return value
  if (process.env.NODE_ENV === "production") {
    // Loud rather than silent. The previous behaviour hid this: robots.ts
    // hardcoded the production domain while getShareUrl handed users a
    // localhost link, so a missing variable looked fine from one angle and
    // broke sharing from another.
    console.error(
      `[config] ${name} is not set in production. Falling back to ${fallback}, ` +
        `which is almost certainly wrong for absolute URLs (share links, emails, robots.txt).`
    )
  }
  return fallback
}

export const config = {
  /**
   * The absolute origin of this deployment, for building absolute URLs: share
   * links pasted into a user's clipboard, email links, web-push claims,
   * robots.txt.
   *
   * Previously read at seven sites with four different fallbacks:
   * `https://infinistar.app`, `http://localhost:3000`, `https://localhost`,
   * and nothing at all.
   */
  get appUrl(): string {
    return warnIfMissingInProduction(
      "NEXT_PUBLIC_APP_URL",
      process.env.NEXT_PUBLIC_APP_URL,
      DEV_APP_URL
    )
  },

  /**
   * The same variable, raw and possibly undefined.
   *
   * Not redundant with `appUrl`: some callers must tell "not configured" from
   * "configured to the dev default", because their safe answer when it is
   * missing is to deny rather than to guess. The CORS allowlist is the case
   * that matters — handing it the dev fallback would allow
   * `http://localhost:3000` as a cross-origin caller on a production deploy
   * whose variable was unset, where the correct behaviour is to allow nothing.
   *
   * Reach for `appUrl` when building an absolute URL, and this when the absence
   * of configuration should close a door.
   */
  get configuredAppUrl(): string | undefined {
    return process.env.NEXT_PUBLIC_APP_URL
  },

  /**
   * PostHog has two hosts and they are not interchangeable.
   *
   * `ingestHost` is where events are sent; `uiHost` is where "view in PostHog"
   * links point. A single `NEXT_PUBLIC_POSTHOG_HOST` was serving both with
   * different defaults per call site, so setting it correctly for one silently
   * broke the other: point it at the ingestion host and dashboard links break;
   * point it at the app host and server-side events are posted to an endpoint
   * that does not ingest them.
   *
   * `NEXT_PUBLIC_POSTHOG_HOST` keeps its PostHog-documented meaning, the
   * ingestion host. The UI host is separate and optional.
   */
  posthog: {
    get ingestHost(): string {
      return process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com"
    },
    get uiHost(): string {
      return process.env.NEXT_PUBLIC_POSTHOG_UI_HOST || "https://us.posthog.com"
    },
  },
}
