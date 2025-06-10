import crypto from "crypto"

/**
 * Timing-safe check that an incoming Authorization header matches the
 * expected `Bearer ${cronSecret}` value.
 *
 * Uses a length guard plus crypto.timingSafeEqual so an attacker cannot
 * recover the secret byte-by-byte through response-time differences
 * (a plain `!==` comparison short-circuits on the first mismatched character).
 *
 * Returns false when either value is missing — callers decide how to respond
 * (e.g. 401 vs 500/503) when CRON_SECRET itself is not configured.
 */
export function isAuthorizedCronRequest(
  authHeader: string | null,
  cronSecret: string | null | undefined
): boolean {
  if (!authHeader || !cronSecret) {
    return false
  }

  // Reject oversized headers before allocating Buffers for them.
  if (authHeader.length > 1024) {
    return false
  }

  const expected = Buffer.from(`Bearer ${cronSecret}`)
  const provided = Buffer.from(authHeader)

  if (expected.length !== provided.length) {
    return false
  }

  return crypto.timingSafeEqual(provided, expected)
}
