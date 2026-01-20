import { NextResponse, type NextRequest } from "next/server"

/**
 * Rate Limiter Interface
 *
 * Implement this interface to create custom rate limiters (e.g., Redis-based)
 */
export interface IRateLimiter {
  check(identifier: string): boolean | Promise<boolean>
  reset(identifier: string): void | Promise<void>
  cleanup(): void | Promise<void>
}

/**
 * In-Memory Rate Limiter
 *
 * IMPORTANT: This implementation stores rate limit data in memory.
 *
 * Limitations for production:
 * - Does not persist across server restarts
 * - Does not work correctly with multiple server instances (horizontal scaling)
 * - Memory usage grows with number of unique identifiers
 *
 * For production deployments with multiple instances, implement IRateLimiter
 * using a distributed store like Redis. Example Redis implementation:
 *
 * ```typescript
 * class RedisRateLimiter implements IRateLimiter {
 *   private redis: Redis
 *   private limit: number
 *   private windowMs: number
 *
 *   constructor(redis: Redis, limit: number, windowMs: number) {
 *     this.redis = redis
 *     this.limit = limit
 *     this.windowMs = windowMs
 *   }
 *
 *   async check(identifier: string): Promise<boolean> {
 *     const key = `ratelimit:${identifier}`
 *     const now = Date.now()
 *     const windowStart = now - this.windowMs
 *
 *     // Use Redis sorted set with timestamps as scores
 *     await this.redis.zremrangebyscore(key, 0, windowStart)
 *     const count = await this.redis.zcard(key)
 *
 *     if (count >= this.limit) return false
 *
 *     await this.redis.zadd(key, now, `${now}`)
 *     await this.redis.expire(key, Math.ceil(this.windowMs / 1000))
 *     return true
 *   }
 *
 *   async reset(identifier: string): Promise<void> {
 *     await this.redis.del(`ratelimit:${identifier}`)
 *   }
 *
 *   async cleanup(): Promise<void> {
 *     // Redis TTL handles cleanup automatically
 *   }
 * }
 * ```
 */
export class InMemoryRateLimiter implements IRateLimiter {
  private requests: Map<string, number[]> = new Map()
  private limit: number
  private windowMs: number

  constructor(limit: number = 10, windowMs: number = 60000) {
    this.limit = limit
    this.windowMs = windowMs
  }

  check(identifier: string): boolean {
    const now = Date.now()
    const requestTimestamps = this.requests.get(identifier) || []

    // Remove old timestamps outside the window
    const validTimestamps = requestTimestamps.filter((timestamp) => now - timestamp < this.windowMs)

    if (validTimestamps.length >= this.limit) {
      return false // Rate limit exceeded
    }

    // Add current timestamp
    validTimestamps.push(now)
    this.requests.set(identifier, validTimestamps)

    return true
  }

  reset(identifier: string): void {
    this.requests.delete(identifier)
  }

  cleanup(): void {
    const now = Date.now()
    for (const [identifier, timestamps] of this.requests.entries()) {
      const validTimestamps = timestamps.filter((timestamp) => now - timestamp < this.windowMs)
      if (validTimestamps.length === 0) {
        this.requests.delete(identifier)
      } else {
        this.requests.set(identifier, validTimestamps)
      }
    }
  }
}

// Different rate limiters for different endpoints
// To use Redis in production, replace InMemoryRateLimiter with RedisRateLimiter
export const apiLimiter = new InMemoryRateLimiter(60, 60000) // 60 requests per minute
export const authLimiter = new InMemoryRateLimiter(5, 300000) // 5 requests per 5 minutes
export const aiChatLimiter = new InMemoryRateLimiter(20, 60000) // 20 AI requests per minute
export const accountDeletionLimiter = new InMemoryRateLimiter(3, 3600000) // 3 requests per hour
export const twoFactorLimiter = new InMemoryRateLimiter(5, 300000) // 5 attempts per 5 minutes for 2FA verification
export const tagLimiter = new InMemoryRateLimiter(30, 60000) // 30 tag operations per minute
export const memoryLimiter = new InMemoryRateLimiter(30, 60000) // 30 memory operations per minute
export const memoryExtractLimiter = new InMemoryRateLimiter(5, 60000) // 5 AI extraction requests per minute
export const templateLimiter = new InMemoryRateLimiter(30, 60000) // 30 template operations per minute
export const shareLimiter = new InMemoryRateLimiter(10, 60000) // 10 share operations per minute
export const shareJoinLimiter = new InMemoryRateLimiter(5, 60000) // 5 join attempts per minute

// Cleanup old entries every 5 minutes
setInterval(() => {
  apiLimiter.cleanup()
  authLimiter.cleanup()
  aiChatLimiter.cleanup()
  accountDeletionLimiter.cleanup()
  twoFactorLimiter.cleanup()
  tagLimiter.cleanup()
  memoryLimiter.cleanup()
  memoryExtractLimiter.cleanup()
  templateLimiter.cleanup()
  shareLimiter.cleanup()
  shareJoinLimiter.cleanup()
}, 300000)

// Helper function to get client identifier
export function getClientIdentifier(request: NextRequest): string {
  // Try to get user email from session
  // Fall back to IP address
  const forwarded = request.headers.get("x-forwarded-for")
  const realIp = request.headers.get("x-real-ip")
  const ip = forwarded ? forwarded.split(",")[0] : realIp || "unknown"
  return ip
}

// Middleware wrapper for rate limiting
// Supports both sync (InMemoryRateLimiter) and async (RedisRateLimiter) implementations
export function withRateLimit(
  limiter: IRateLimiter,
  handler: (request: NextRequest) => Promise<NextResponse>
) {
  return async (request: NextRequest): Promise<NextResponse> => {
    const identifier = getClientIdentifier(request)

    const allowed = await Promise.resolve(limiter.check(identifier))
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
