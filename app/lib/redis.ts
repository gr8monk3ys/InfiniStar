import Redis from "ioredis"

import { dbLogger } from "@/app/lib/logger"

/**
 * Redis Client Singleton
 *
 * Provides a shared Redis connection for rate limiting, 2FA token storage,
 * and other distributed state needs. Falls back gracefully when REDIS_URL
 * is not configured -- callers should check for null and use in-memory
 * alternatives.
 */

let redisClient: Redis | null = null
let connectionAttempted = false

/**
 * Returns the singleton Redis client, or null if Redis is not configured
 * or the connection failed.
 *
 * The client is created lazily on first call and reused for all subsequent
 * calls. If REDIS_URL is not set, this always returns null without logging
 * repeated warnings.
 */
export function getRedisClient(): Redis | null {
  if (connectionAttempted) {
    return redisClient
  }

  connectionAttempted = true

  const redisUrl = process.env.REDIS_URL

  if (!redisUrl) {
    dbLogger.warn(
      "REDIS_URL is not configured. Falling back to in-memory storage. " +
        "Set REDIS_URL for distributed rate limiting and 2FA token storage."
    )
    return null
  }

  try {
    redisClient = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      retryStrategy(times: number): number | null {
        if (times > 5) {
          dbLogger.error("Max reconnection attempts reached. Giving up.")
          return null
        }
        // Exponential backoff: 200ms, 400ms, 800ms, 1600ms, 3200ms
        const delay = Math.min(times * 200, 5000)
        return delay
      },
      lazyConnect: false,
      enableReadyCheck: true,
      connectTimeout: 10000,
    })

    redisClient.on("connect", () => {
      dbLogger.info("Redis connected successfully")
    })

    redisClient.on("error", (error: Error) => {
      dbLogger.error({ err: error }, "Redis connection error")
    })

    redisClient.on("close", () => {
      dbLogger.warn("Redis connection closed")
    })

    return redisClient
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    dbLogger.error(
      { err: error instanceof Error ? error : new Error(message) },
      "Failed to create Redis client. Falling back to in-memory storage."
    )
    redisClient = null
    return null
  }
}

/**
 * Checks whether a Redis connection is available and responsive.
 */
export async function isRedisAvailable(): Promise<boolean> {
  const client = getRedisClient()
  if (!client) {
    return false
  }

  try {
    const result = await client.ping()
    return result === "PONG"
  } catch {
    return false
  }
}
