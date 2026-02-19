/**
 * @jest-environment node
 *
 * Rate Limiter Tests
 *
 * Tests the actual rate-limit module exports: InMemoryRateLimiter, createRateLimiter,
 * the pre-built limiter instances, and getClientIdentifier.
 */
import { NextRequest } from "next/server"

import {
  aiChatLimiter,
  apiLimiter,
  authLimiter,
  createRateLimiter,
  getClientIdentifier,
  InMemoryRateLimiter,
} from "@/app/lib/rate-limit"

// Mock Redis to force in-memory fallback — no real Redis connection needed
jest.mock("@/app/lib/redis", () => ({
  getRedisClient: () => null,
}))

// Mock logger to suppress noise during tests
jest.mock("@/app/lib/logger", () => ({
  apiLogger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
  dbLogger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}))

describe("getClientIdentifier", () => {
  it("prefers x-vercel-forwarded-for and uses the first IP in the list", () => {
    const req = new NextRequest("http://localhost/api/test", {
      headers: { "x-vercel-forwarded-for": "1.2.3.4, 5.6.7.8" },
    })
    expect(getClientIdentifier(req)).toBe("1.2.3.4")
  })

  it("falls back to the rightmost x-forwarded-for IP", () => {
    const req = new NextRequest("http://localhost/api/test", {
      headers: { "x-forwarded-for": "1.1.1.1, 2.2.2.2, 3.3.3.3" },
    })
    expect(getClientIdentifier(req)).toBe("3.3.3.3")
  })

  it("falls back to x-real-ip when no forwarded headers are present", () => {
    const req = new NextRequest("http://localhost/api/test", {
      headers: { "x-real-ip": "5.5.5.5" },
    })
    expect(getClientIdentifier(req)).toBe("5.5.5.5")
  })

  it('returns "unknown" when no IP headers are present', () => {
    const req = new NextRequest("http://localhost/api/test")
    expect(getClientIdentifier(req)).toBe("unknown")
  })
})

describe("InMemoryRateLimiter (direct)", () => {
  it("allows requests under the limit", () => {
    const limiter = new InMemoryRateLimiter(3, 60_000)
    const id = `allow-${Date.now()}`
    expect(limiter.check(id)).toBe(true)
    expect(limiter.check(id)).toBe(true)
    expect(limiter.check(id)).toBe(true)
  })

  it("blocks requests over the limit", () => {
    const limiter = new InMemoryRateLimiter(3, 60_000)
    const id = `block-${Date.now()}`
    limiter.check(id)
    limiter.check(id)
    limiter.check(id)
    expect(limiter.check(id)).toBe(false)
  })

  it("tracks different identifiers independently", () => {
    const limiter = new InMemoryRateLimiter(2, 60_000)
    const id1 = `user-a-${Date.now()}`
    const id2 = `user-b-${Date.now()}`

    limiter.check(id1)
    limiter.check(id1)
    expect(limiter.check(id1)).toBe(false)

    // id2 should still have its full quota
    expect(limiter.check(id2)).toBe(true)
  })

  it("allows requests again after the window expires", async () => {
    const limiter = new InMemoryRateLimiter(2, 100) // 100ms window
    const id = `expire-${Date.now()}`

    limiter.check(id)
    limiter.check(id)
    expect(limiter.check(id)).toBe(false)

    await new Promise((resolve) => setTimeout(resolve, 150))

    expect(limiter.check(id)).toBe(true)
  })

  it("resets the count for a specific identifier", () => {
    const limiter = new InMemoryRateLimiter(2, 60_000)
    const id = `reset-${Date.now()}`

    limiter.check(id)
    limiter.check(id)
    expect(limiter.check(id)).toBe(false)

    limiter.reset(id)

    expect(limiter.check(id)).toBe(true)
  })

  it("reset does not throw for unknown identifiers", () => {
    const limiter = new InMemoryRateLimiter(5, 60_000)
    expect(() => limiter.reset("nonexistent-id")).not.toThrow()
  })

  it("cleanup removes expired entries", async () => {
    const limiter = new InMemoryRateLimiter(2, 50) // 50ms window
    const id = `cleanup-${Date.now()}`

    limiter.check(id)
    await new Promise((resolve) => setTimeout(resolve, 100))

    limiter.cleanup()

    // After cleanup, both slots should be available again
    expect(limiter.check(id)).toBe(true)
    expect(limiter.check(id)).toBe(true)
    expect(limiter.check(id)).toBe(false)
  })

  it("cleanup does not throw on empty state", () => {
    const limiter = new InMemoryRateLimiter(5, 60_000)
    expect(() => limiter.cleanup()).not.toThrow()
  })
})

describe("createRateLimiter (factory)", () => {
  it("creates an in-memory limiter with specified max and window (Redis mocked as null)", () => {
    const limiter = createRateLimiter("test-limiter", 3, 60_000)
    const id = `factory-${Date.now()}`
    expect(limiter.check(id)).toBe(true)
    expect(limiter.check(id)).toBe(true)
    expect(limiter.check(id)).toBe(true)
    expect(limiter.check(id)).toBe(false)
  })
})

describe("pre-built limiter instances", () => {
  it("apiLimiter allows a new unique identifier", () => {
    const id = `api-${Date.now()}-${Math.random()}`
    expect(apiLimiter.check(id)).toBe(true)
  })

  it("authLimiter has a stricter limit — blocks after 5 requests", () => {
    const id = `auth-${Date.now()}-${Math.random()}`
    for (let i = 0; i < 5; i++) {
      authLimiter.check(id)
    }
    expect(authLimiter.check(id)).toBe(false)
  })

  it("aiChatLimiter allows a new unique identifier", () => {
    const id = `ai-${Date.now()}-${Math.random()}`
    expect(aiChatLimiter.check(id)).toBe(true)
  })
})

export {}
