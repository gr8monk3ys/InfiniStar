import { NextResponse, type NextRequest } from "next/server"

import { apiLogger } from "@/app/lib/logger"
import { getRedisClient } from "@/app/lib/redis"
import { RedisRateLimiter } from "@/app/lib/redis-rate-limiter"

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
 * This class is used as the fallback when Redis is not available.
 * When REDIS_URL is configured, RedisRateLimiter is used instead.
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

/**
 * Factory function that creates either a Redis-backed or in-memory rate limiter
 * depending on whether Redis is available.
 *
 * When REDIS_URL is set and Redis is reachable, returns a RedisRateLimiter
 * that works correctly across multiple server instances and survives restarts.
 *
 * When Redis is unavailable, falls back to InMemoryRateLimiter.
 */
let rateLimiterBackendLogged = false

function createRateLimiter(name: string, limit: number, windowMs: number): IRateLimiter {
  const redis = getRedisClient()

  if (redis) {
    if (!rateLimiterBackendLogged) {
      apiLogger.info("Using Redis-backed rate limiting")
      rateLimiterBackendLogged = true
    }
    return new RedisRateLimiter(redis, name, limit, windowMs)
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

// Cleanup old entries every 5 minutes (only relevant for in-memory limiters)
setInterval(() => {
  apiLimiter.cleanup()
  authLimiter.cleanup()
  aiChatLimiter.cleanup()
  aiTranscribeLimiter.cleanup()
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
): (request: NextRequest) => Promise<NextResponse> {
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
