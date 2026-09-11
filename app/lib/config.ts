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

/**
 * Where support mail goes when the variable is unset.
 *
 * On a domain the project controls, so a misconfiguration is one Cloudflare
 * Email Routing rule away from working rather than a dead end. It was
 * `support@infinistar.app` — a domain that has never been registered, so every
 * one of the fourteen places that printed it was inviting users to write into
 * nothing, including the GDPR contact in the privacy policy and the DMCA
 * contact in the terms.
 */
const FALLBACK_SUPPORT_EMAIL = "support@lscaturchio.xyz"

/**
 * @param consequence what goes wrong when the fallback is used, in the
 *   caller's own terms. This used to be one hardcoded sentence about "absolute
 *   URLs (share links, emails, robots.txt)", which is true of `appUrl` and
 *   nonsense for the two address variables — a reader chasing a real warning
 *   about `SMTP_FROM` was told to go and look at robots.txt.
 */
function warnIfMissingInProduction(
  name: string,
  value: string | undefined,
  fallback: string,
  consequence: string
) {
  if (value) return value
  if (process.env.NODE_ENV === "production") {
    // Loud rather than silent. The previous behaviour hid this: robots.ts
    // hardcoded the production domain while getShareUrl handed users a
    // localhost link, so a missing variable looked fine from one angle and
    // broke sharing from another.
    //
    // Note that preview deployments also run with NODE_ENV=production, so a
    // variable scoped to Production alone fires this on every preview. That is
    // not a false alarm worth silencing: previews share the production
    // database, so a preview showing the fallback is showing real users' data
    // next to the wrong contact address.
    console.error(`[config] ${name} is not set in production. Using ${fallback} — ${consequence}`)
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
      DEV_APP_URL,
      "every absolute URL this deployment builds will point at localhost: share links, " +
        "email links, web-push claims and robots.txt."
    )
  },

  /**
   * The address transactional mail is sent from.
   *
   * Postmark refuses to send from an unverified domain, so this and the domain
   * in `appUrl` have to agree with what is verified there — a mismatch is not a
   * bounce the user sees, it is five emails that silently never arrive:
   * the welcome on every signup, three account-deletion notices that are a GDPR
   * commitment, and the payment-failure notice.
   */
  get fromEmail(): string {
    return warnIfMissingInProduction(
      "SMTP_FROM",
      process.env.SMTP_FROM,
      FALLBACK_SUPPORT_EMAIL,
      "mail will be sent from an address the provider may not have verified, and an " +
        "unverified sender is rejected rather than delivered."
    )
  },

  /**
   * The address users are told to write to.
   *
   * Previously hardcoded at fourteen sites — the privacy policy's GDPR contact,
   * the terms' DMCA and disputes contact, the auth error boundary, the upgrade
   * modal, the account-deletion tab and the email templates. Changing it meant
   * a deploy and finding all fourteen; missing one meant printing two different
   * addresses on the same site.
   *
   * Legally load-bearing in two of those places, which is why it warns in
   * production rather than failing quietly: an unreachable contact in a privacy
   * policy is a promise the product cannot keep.
   */
  get supportEmail(): string {
    return warnIfMissingInProduction(
      "NEXT_PUBLIC_SUPPORT_EMAIL",
      process.env.NEXT_PUBLIC_SUPPORT_EMAIL,
      FALLBACK_SUPPORT_EMAIL,
      "the privacy policy's GDPR contact and the terms' DMCA contact will print an " +
        "address nobody chose."
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
