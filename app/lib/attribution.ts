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

// --- Slice A3: server-side cookie value parsing + persistence resolution ---
// The helpers above (slice A1) own the cookie name and the client/document.cookie
// read/write. The helpers below parse the persisted cookie *value* (as read server-
// side via cookies().get(name)?.value) and resolve which User columns to write —
// first-touch wins, so an already-attributed user is never overwritten.

const MAX_FIELD_LEN = 255

/** Shape of the JSON stored in the `ist_attribution` cookie. */
export interface AttributionCookie {
  utmSource?: string
  utmMedium?: string
  utmCampaign?: string
  ref?: string
  firstTouchAt?: string
}

/** Columns currently stored on the User row that determine "already attributed". */
export interface UserAttributionState {
  utmSource: string | null
  utmMedium: string | null
  utmCampaign: string | null
  referralSource: string | null
  firstTouchAt: Date | null
}

/** Subset of User columns to write. Empty object => write nothing. */
export interface AttributionPersistInput {
  utmSource?: string
  utmMedium?: string
  utmCampaign?: string
  referralSource?: string
  firstTouchAt?: Date
}

function coerceField(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined
  const trimmed = value.trim()
  if (!trimmed) return undefined
  return trimmed.slice(0, MAX_FIELD_LEN)
}

/**
 * Parse the raw `ist_attribution` cookie value into a typed payload.
 * Returns null for missing/empty/malformed JSON. Non-string fields are dropped;
 * string fields are trimmed and capped to 255 chars.
 */
export function parseAttributionCookie(raw: string | undefined | null): AttributionCookie | null {
  if (!raw) return null
  let obj: unknown
  try {
    obj = JSON.parse(raw)
  } catch {
    return null
  }
  if (!obj || typeof obj !== "object") return null
  const src = obj as Record<string, unknown>
  const out: AttributionCookie = {}
  const utmSource = coerceField(src.utmSource)
  const utmMedium = coerceField(src.utmMedium)
  const utmCampaign = coerceField(src.utmCampaign)
  const ref = coerceField(src.ref)
  const firstTouchAt = coerceField(src.firstTouchAt)
  if (utmSource) out.utmSource = utmSource
  if (utmMedium) out.utmMedium = utmMedium
  if (utmCampaign) out.utmCampaign = utmCampaign
  if (ref) out.ref = ref
  if (firstTouchAt) out.firstTouchAt = firstTouchAt
  return out
}

function isAlreadyAttributed(state: UserAttributionState): boolean {
  return Boolean(
    state.firstTouchAt ||
    state.utmSource ||
    state.utmMedium ||
    state.utmCampaign ||
    state.referralSource
  )
}

/**
 * Given the parsed cookie and the user's current attribution state, return the
 * columns to persist. Returns {} when there is no cookie OR the user is already
 * attributed (first-touch wins). A missing/invalid firstTouchAt in the cookie is
 * synthesized to "now" so the user is still marked attributed going forward.
 */
export function resolveAttribution(
  cookie: AttributionCookie | null,
  state: UserAttributionState
): AttributionPersistInput {
  if (!cookie) return {}
  if (isAlreadyAttributed(state)) return {}

  const out: AttributionPersistInput = {}
  if (cookie.utmSource) out.utmSource = cookie.utmSource
  if (cookie.utmMedium) out.utmMedium = cookie.utmMedium
  if (cookie.utmCampaign) out.utmCampaign = cookie.utmCampaign
  if (cookie.ref) out.referralSource = cookie.ref

  // Only mark attributed if we actually have *some* signal.
  const hasSignal = out.utmSource || out.utmMedium || out.utmCampaign || out.referralSource
  if (!hasSignal) return {}

  const parsedTouch = cookie.firstTouchAt ? new Date(cookie.firstTouchAt) : null
  out.firstTouchAt = parsedTouch && !Number.isNaN(parsedTouch.getTime()) ? parsedTouch : new Date()

  return out
}
