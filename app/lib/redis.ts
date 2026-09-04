import { captureMessage } from "@sentry/nextjs"
import { Redis } from "@upstash/redis"

import { dbLogger } from "@/app/lib/logger"

/**
 * Redis client singleton.
 *
 * Upstash's REST client, not ioredis. A serverless function that opens a raw
 * TCP connection at module load — which is what `new Redis(url, { lazyConnect:
 * false })` did — leaks a connection per cold start and cannot survive the
 * platform freezing the instance between invocations. The REST client holds no
 * socket, so there is nothing to leak and nothing to reconnect.
 *
 * `RedisLike` in `@gr8monk3ys/next-kit/rate-limit` is documented as satisfied
 * by this client as-is (`incr`, `pexpire`, `pttl`, `del`), so `rate-limit.ts`
 * needs no change.
 *
 * Returns null when Upstash is not configured, and callers fall back to
 * in-memory storage. That is correct locally and is NOT correct in production,
 * where it makes rate limiting per-instance — `/api/health` reports degraded
 * when it happens there.
 */
let redisClient: Redis | null = null
let connectionAttempted = false

export function getRedisClient(): Redis | null {
  if (connectionAttempted) {
    return redisClient
  }

  connectionAttempted = true

  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN

  if (!url || !token) {
    const message =
      "Upstash is not configured. Falling back to in-memory storage. " +
      "Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN for " +
      "distributed rate limiting and 2FA token storage."

    dbLogger.warn(message)

    // In production this is not a warning, it is an outage — rate limiting and
    // 2FA tokens silently become per-instance. The original incident stood for
    // days because nothing reported it anywhere a person would look.
    //
    // `connectionAttempted` is already true above, so this fires once per cold
    // start rather than once per request. A scheduled probe was the obvious
    // alternative and is worse here: every cron in vercel.json runs daily, so
    // a probe would find the outage up to 24 hours late. This fires on real
    // traffic.
    if (process.env.NODE_ENV === "production") {
      captureMessage(message, { level: "error" })
    }

    return null
  }

  try {
    redisClient = new Redis({ url, token })
    return redisClient
  } catch (error) {
    dbLogger.error(
      { err: error instanceof Error ? error : new Error(String(error)) },
      "Failed to create the Upstash client. Falling back to in-memory storage."
    )
    redisClient = null
    return null
  }
}

/** Whether Redis is configured and responding. Drives `/api/health`. */
export async function isRedisAvailable(): Promise<boolean> {
  const client = getRedisClient()
  if (!client) {
    return false
  }

  try {
    const result = await client.ping()
    return typeof result === "string" && result.toUpperCase() === "PONG"
  } catch {
    return false
  }
}
