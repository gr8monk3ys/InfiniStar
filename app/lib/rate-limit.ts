import { NextResponse, type NextRequest } from "next/server"
import {
  createRateLimiter as createKitRateLimiter,
  getClientId,
  MemoryStore,
  RedisStore,
  type RateLimiter,
  type RateLimitStore,
} from "@gr8monk3ys/next-kit/rate-limit"

import { apiLogger } from "@/app/lib/logger"
import { getRedisClient } from "@/app/lib/redis"

/**
 * Rate Limiter Interface
 *
 * The window accounting and the stores come from `@gr8monk3ys/next-kit`; this
 * module owns the per-endpoint limits, the singletons the API routes import,
 * and this interface.
 *
 * `check` is async on both backends. Every call site already writes
 * `await Promise.resolve(limiter.check(id))`, so nothing needed changing.
 */
export interface IRateLimiter {
  check(identifier: string): Promise<boolean>
  reset(identifier: string): Promise<void>
  cleanup(): Promise<void>
}

/**
 * Adapts a kit limiter — which reports `{ ok, remaining, resetAt }` — to the
 * boolean this app's routes expect.
 */
class KitRateLimiter implements IRateLimiter {
  constructor(private readonly limiter: RateLimiter) {}

  async check(identifier: string): Promise<boolean> {
    return (await this.limiter.check(identifier)).ok
  }

  async reset(identifier: string): Promise<void> {
    await this.limiter.reset(identifier)
  }

  async cleanup(): Promise<void> {
    await this.limiter.cleanup()
  }
}

function build(store: RateLimitStore, limit: number, windowMs: number): RateLimiter {
  return createKitRateLimiter({ store, limit, windowMs })
}

/**
 * In-Memory Rate Limiter
 *
 * IMPORTANT: This implementation stores rate limit data in memory.
 *
 * Limitations for production:
 * - Does not persist across server restarts
 * - Does not work correctly with multiple server instances (horizontal scaling)
 *
 * This class is used as the fallback when Redis is not available.
 * When REDIS_URL is configured, a Redis-backed store is used instead.
 */
export class InMemoryRateLimiter extends KitRateLimiter {
  constructor(limit: number = 10, windowMs: number = 60000) {
    super(build(new MemoryStore(), limit, windowMs))
  }
}

/**
 * Factory function that creates either a Redis-backed or in-memory rate limiter
 * depending on whether Redis is available.
 *
 * When REDIS_URL is set and Redis is reachable, returns a limiter backed by a
 * Redis counter that works correctly across multiple server instances and
 * survives restarts. The ioredis client already satisfies the kit's `RedisLike`
 * shape (`incr` / `pexpire` / `pttl` / `del`), so no adapter is needed.
 *
 * When Redis is unavailable, falls back to InMemoryRateLimiter.
 */
let rateLimiterBackendLogged = false

export function createRateLimiter(name: string, limit: number, windowMs: number): IRateLimiter {
  const redis = getRedisClient()

  if (redis) {
    if (!rateLimiterBackendLogged) {
      apiLogger.info("Using Redis-backed rate limiting")
      rateLimiterBackendLogged = true
    }

    const store = new RedisStore(redis, {
      // v2 because the key format changed shape, not just contents: until this
      // commit `ratelimit:<name>:<id>` held a ZSET (sliding window). INCR on a
      // surviving one of those returns WRONGTYPE, which RedisStore treats as an
      // outage and fails open — so reusing the prefix would disable rate
      // limiting for exactly the identifiers currently being limited, for as
      // long as the old TTL runs (5 min for auth, 60 min for accountDeletion).
      prefix: `ratelimit:v2:${name}:`,
      // Redis being unreachable must not block legitimate traffic.
      onError: "open",
      onErrorLog: (error: unknown) => {
        apiLogger.error(
          { err: error instanceof Error ? error : new Error(String(error)), name },
          "Rate limit check failed"
        )
      },
    })

    return new KitRateLimiter(build(store, limit, windowMs))
  }

  if (!rateLimiterBackendLogged) {
    apiLogger.info("Using in-memory rate limiting (Redis not available)")
    rateLimiterBackendLogged = true
  }
  return new InMemoryRateLimiter(limit, windowMs)
}

// Different rate limiters for different endpoints
export const apiLimiter = createRateLimiter("api", 60, 60000) // 60 requests per minute
export const authLimiter = createRateLimiter("auth", 5, 300000) // 5 requests per 5 minutes
export const aiChatLimiter = createRateLimiter("aiChat", 20, 60000) // 20 AI requests per minute
export const aiTranscribeLimiter = createRateLimiter("aiTranscribe", 10, 60000) // 10 transcription requests per minute
export const accountDeletionLimiter = createRateLimiter("accountDeletion", 3, 3600000) // 3 requests per hour
export const twoFactorLimiter = createRateLimiter("twoFactor", 5, 300000) // 5 attempts per 5 minutes for 2FA verification
export const tagLimiter = createRateLimiter("tag", 30, 60000) // 30 tag operations per minute
export const memoryLimiter = createRateLimiter("memory", 30, 60000) // 30 memory operations per minute
export const memoryExtractLimiter = createRateLimiter("memoryExtract", 5, 60000) // 5 AI extraction requests per minute
export const templateLimiter = createRateLimiter("template", 30, 60000) // 30 template operations per minute
export const shareLimiter = createRateLimiter("share", 10, 60000) // 10 share operations per minute
export const shareJoinLimiter = createRateLimiter("shareJoin", 5, 60000) // 5 join attempts per minute
export const csrfLimiter = createRateLimiter("csrf", 30, 60000) // 30 CSRF token requests per minute
export const creatorPaymentLimiter = createRateLimiter("creatorPayment", 5, 600000) // 5 requests per 10 minutes
export const suggestionsLimiter = createRateLimiter("suggestions", 30, 60000) // 30 suggestion requests per minute

// Every limiter in the module, so cleanup cannot silently miss one.
const allLimiters: IRateLimiter[] = [
  apiLimiter,
  authLimiter,
  aiChatLimiter,
  aiTranscribeLimiter,
  accountDeletionLimiter,
  twoFactorLimiter,
  tagLimiter,
  memoryLimiter,
  memoryExtractLimiter,
  templateLimiter,
  shareLimiter,
  shareJoinLimiter,
  csrfLimiter,
  creatorPaymentLimiter,
  suggestionsLimiter,
]

// Cleanup old entries every 5 minutes (a no-op for Redis limiters, which rely
// on key TTLs). cleanup() returns a promise, so each call is explicitly voided
// with a rejection handler — an unhandled rejection in a timer callback would
// otherwise crash the process.
const cleanupInterval = setInterval(() => {
  for (const limiter of allLimiters) {
    void limiter.cleanup().catch((error: unknown) => {
      apiLogger.error(
        { err: error instanceof Error ? error : new Error(String(error)) },
        "Rate limiter cleanup failed"
      )
    })
  }
}, 300000)

cleanupInterval.unref?.()

/**
 * Helper function to get client identifier.
 *
 * `platform: "vercel"` is the security-relevant argument. InfiniStar deploys on
 * Vercel (see `vercel.json`), so `x-vercel-forwarded-for` is written by our own
 * edge and cannot be forged — but `cf-connecting-ip` is NOT, because there is no
 * Cloudflare in front of this app to overwrite an inbound copy of it. next-kit
 * <= 0.1.1 trusted `cf-connecting-ip` unconditionally, which let any caller mint
 * a fresh rate-limit bucket per request by sending a new value for it. From
 * 0.1.2 a platform header is read only when that platform is declared, and
 * declaring "vercel" keeps `cf-connecting-ip` out of the trusted set.
 *
 * After the platform header: the RIGHT-most x-forwarded-for entry — the hop our
 * own edge appended. Taking the left-most would let anyone mint a fresh
 * rate-limit bucket per request just by rotating the header.
 */
export function getClientIdentifier(request: NextRequest): string {
  return getClientId(request, { platform: "vercel", fallback: "anonymous" })
}

// Middleware wrapper for rate limiting
export function withRateLimit(
  limiter: IRateLimiter,
  handler: (request: NextRequest) => Promise<NextResponse>
): (request: NextRequest) => Promise<NextResponse> {
  return async (request: NextRequest): Promise<NextResponse> => {
    const identifier = getClientIdentifier(request)

    const allowed = await limiter.check(identifier)
    if (!allowed) {
      return new NextResponse(
        JSON.stringify({
          error: "Too many requests. Please try again later.",
        }),
        {
          status: 429,
          headers: {
            "Content-Type": "application/json",
            "Retry-After": "60",
          },
        }
      )
    }

    return handler(request)
  }
}
