import type Redis from "ioredis"

import { apiLogger } from "@/app/lib/logger"
import type { IRateLimiter } from "@/app/lib/rate-limit"

/**
 * Redis-backed Rate Limiter
 *
 * Uses Redis sorted sets with a sliding window algorithm. Each request is
 * stored as a member with its timestamp as the score. Expired entries are
 * pruned atomically before checking the count.
 *
 * Key pattern: ratelimit:{name}:{identifier}
 * TTL: Automatically set to the window duration so Redis cleans up idle keys.
 */
export class RedisRateLimiter implements IRateLimiter {
  private redis: Redis
  private name: string
  private limit: number
  private windowMs: number

  constructor(redis: Redis, name: string, limit: number, windowMs: number) {
    this.redis = redis
    this.name = name
    this.limit = limit
    this.windowMs = windowMs
  }

  private getKey(identifier: string): string {
    return `ratelimit:${this.name}:${identifier}`
  }

  async check(identifier: string): Promise<boolean> {
    const key = this.getKey(identifier)
    const now = Date.now()
    const windowStart = now - this.windowMs

    try {
      const pipeline = this.redis.pipeline()

      // Remove entries outside the current window
      pipeline.zremrangebyscore(key, 0, windowStart)

      // Count remaining entries
      pipeline.zcard(key)

      // Add current request (will only be committed if under limit)
      // We add it optimistically and remove if over limit
      const member = `${now}:${Math.random().toString(36).slice(2, 8)}`
      pipeline.zadd(key, now, member)

      // Set TTL to window duration (seconds, rounded up)
      pipeline.expire(key, Math.ceil(this.windowMs / 1000))

      const results = await pipeline.exec()

      if (!results) {
        // Pipeline failed entirely; allow the request (fail open)
        return true
      }

      // results[1] is the zcard result: [error, count]
      const zcardResult = results[1]
      if (!zcardResult || zcardResult[0]) {
        return true // Error reading count; fail open
      }

      const count = zcardResult[1] as number

      if (count >= this.limit) {
        // Over limit -- remove the entry we just added
        await this.redis.zrem(key, member)
        return false
      }

      return true
    } catch (error) {
      // Redis is unreachable; fail open to avoid blocking legitimate requests
      apiLogger.error(
        { err: error instanceof Error ? error : new Error(String(error)), name: this.name },
        "Rate limit check failed"
      )
      return true
    }
  }

  async reset(identifier: string): Promise<void> {
    try {
      await this.redis.del(this.getKey(identifier))
    } catch (error) {
      apiLogger.error(
        { err: error instanceof Error ? error : new Error(String(error)), name: this.name },
        "Rate limit reset failed"
      )
    }
  }

  async cleanup(): Promise<void> {
    // Redis TTL handles cleanup automatically -- nothing to do.
  }
}
