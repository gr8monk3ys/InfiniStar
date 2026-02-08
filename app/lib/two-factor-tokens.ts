/**
 * Two-Factor Authentication Token Management
 *
 * Manages temporary 2FA tokens used during the login flow.
 * Uses Redis when available for distributed storage that works across
 * multiple server instances. Falls back to in-memory Map when Redis
 * is not configured.
 */

import { getRedisClient } from "@/app/lib/redis"

const TWO_FACTOR_TOKEN_TTL_SECONDS = 5 * 60 // 5 minutes
const TWO_FACTOR_TOKEN_TTL_MS = TWO_FACTOR_TOKEN_TTL_SECONDS * 1000
const REDIS_KEY_PREFIX = "2fa-token:"

/**
 * In-memory fallback store for 2FA login tokens.
 * Used only when Redis is not available.
 */
const inMemoryStore = new Map<string, { token: string; expiresAt: number }>()

// Clean up expired in-memory tokens every minute
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now()
    for (const [email, data] of inMemoryStore.entries()) {
      if (data.expiresAt < now) {
        inMemoryStore.delete(email)
      }
    }
  }, 60000)
}

let backendLogged = false

function logBackend(usingRedis: boolean): void {
  if (backendLogged) return
  backendLogged = true
  if (usingRedis) {
    console.info("[2FA Tokens] Using Redis-backed token storage.")
  } else {
    console.info("[2FA Tokens] Using in-memory token storage (Redis not available).")
  }
}

/**
 * Store a 2FA token for the login flow.
 * Token expires after 5 minutes.
 */
export async function store2FAToken(email: string, token: string): Promise<void> {
  const normalizedEmail = email.toLowerCase()
  const redis = getRedisClient()

  if (redis) {
    logBackend(true)
    try {
      const key = `${REDIS_KEY_PREFIX}${normalizedEmail}`
      await redis.set(key, JSON.stringify({ token }), "EX", TWO_FACTOR_TOKEN_TTL_SECONDS)
      return
    } catch (error) {
      console.error(
        "[2FA Tokens] Redis store failed, falling back to in-memory:",
        error instanceof Error ? error.message : error
      )
    }
  }

  logBackend(false)
  const expiresAt = Date.now() + TWO_FACTOR_TOKEN_TTL_MS
  inMemoryStore.set(normalizedEmail, { token, expiresAt })
}

/**
 * Get a stored 2FA token.
 * Returns null if the token does not exist or has expired.
 */
export async function get2FAToken(email: string): Promise<string | null> {
  const normalizedEmail = email.toLowerCase()
  const redis = getRedisClient()

  if (redis) {
    try {
      const key = `${REDIS_KEY_PREFIX}${normalizedEmail}`
      const raw = await redis.get(key)
      if (!raw) return null

      const parsed = JSON.parse(raw) as { token: string }
      return parsed.token
    } catch (error) {
      console.error(
        "[2FA Tokens] Redis get failed, falling back to in-memory:",
        error instanceof Error ? error.message : error
      )
    }
  }

  // In-memory fallback
  const data = inMemoryStore.get(normalizedEmail)
  if (!data) return null
  if (data.expiresAt < Date.now()) {
    inMemoryStore.delete(normalizedEmail)
    return null
  }
  return data.token
}

/**
 * Clear a 2FA token (e.g., after successful verification).
 */
export async function clear2FAToken(email: string): Promise<void> {
  const normalizedEmail = email.toLowerCase()
  const redis = getRedisClient()

  if (redis) {
    try {
      const key = `${REDIS_KEY_PREFIX}${normalizedEmail}`
      await redis.del(key)
      // Also clear from in-memory in case it was stored there as a fallback
      inMemoryStore.delete(normalizedEmail)
      return
    } catch (error) {
      console.error(
        "[2FA Tokens] Redis clear failed, falling back to in-memory:",
        error instanceof Error ? error.message : error
      )
    }
  }

  inMemoryStore.delete(normalizedEmail)
}
