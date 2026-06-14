// app/lib/attribution.ts
// First-touch marketing attribution captured client-side and mirrored to a
// first-party cookie. Shared contract: cookie name `ist_attribution`, JSON value
// { utmSource?, utmMedium?, utmCampaign?, ref?, firstTouchAt }. First-touch wins.

export const ATTRIBUTION_COOKIE_NAME = "ist_attribution"

// 1 year — long enough to attribute a delayed signup to its first touch.
const ATTRIBUTION_MAX_AGE_SECONDS = 60 * 60 * 24 * 365

export interface AttributionPayload {
  utmSource?: string
  utmMedium?: string
  utmCampaign?: string
  ref?: string
  firstTouchAt: string
}

function firstNonEmpty(params: URLSearchParams, key: string): string | undefined {
  const value = params.get(key)
  if (value === null) {
    return undefined
  }
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

/**
 * Parse UTM + ref params out of a query string. Returns null when none of the
 * tracked params carry a non-blank value (so callers never overwrite an existing
 * first-touch cookie with an empty payload).
 */
export function parseAttributionFromSearch(search: string): AttributionPayload | null {
  const normalized = search.startsWith("?") ? search.slice(1) : search
  if (normalized.length === 0) {
    return null
  }

  const params = new URLSearchParams(normalized)
  const utmSource = firstNonEmpty(params, "utm_source")
  const utmMedium = firstNonEmpty(params, "utm_medium")
  const utmCampaign = firstNonEmpty(params, "utm_campaign")
  const ref = firstNonEmpty(params, "ref")

  if (!utmSource && !utmMedium && !utmCampaign && !ref) {
    return null
  }

  const payload: AttributionPayload = { firstTouchAt: new Date().toISOString() }
  if (utmSource) payload.utmSource = utmSource
  if (utmMedium) payload.utmMedium = utmMedium
  if (utmCampaign) payload.utmCampaign = utmCampaign
  if (ref) payload.ref = ref
  return payload
}

/** Read and decode the attribution payload from a `document.cookie` style string. */
export function readAttributionCookie(cookieString: string): AttributionPayload | null {
  if (!cookieString) {
    return null
  }

  const match = cookieString
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${ATTRIBUTION_COOKIE_NAME}=`))

  if (!match) {
    return null
  }

  const rawValue = match.slice(ATTRIBUTION_COOKIE_NAME.length + 1)
  try {
    const decoded = decodeURIComponent(rawValue)
    const parsed = JSON.parse(decoded) as unknown
    if (parsed && typeof parsed === "object" && "firstTouchAt" in parsed) {
      return parsed as AttributionPayload
    }
    return null
  } catch {
    return null
  }
}

/**
 * Serialize a first-party (NOT httpOnly — the client writes it) cookie string
 * suitable for assigning to `document.cookie`.
 */
export function serializeAttributionCookie(payload: AttributionPayload): string {
  const value = encodeURIComponent(JSON.stringify(payload))
  return `${ATTRIBUTION_COOKIE_NAME}=${value}; path=/; max-age=${ATTRIBUTION_MAX_AGE_SECONDS}; samesite=lax`
}
