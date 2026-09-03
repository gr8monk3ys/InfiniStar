/**
 * @jest-environment node
 *
 * Rate Limiter Tests
 *
 * Tests the actual rate-limit module exports: InMemoryRateLimiter, createRateLimiter,
 * the pre-built limiter instances, and getClientIdentifier.
 *
 * `check`, `reset` and `cleanup` are async on both backends since the module
 * moved onto @gr8monk3ys/next-kit, so every assertion here awaits.
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

  it("prefers the proxy-set x-real-ip over the client-appendable x-forwarded-for", () => {
    const req = new NextRequest("http://localhost/api/test", {
      headers: {
        "x-real-ip": "5.5.5.5",
        "x-forwarded-for": "1.1.1.1, 2.2.2.2",
      },
    })
    expect(getClientIdentifier(req)).toBe("5.5.5.5")
  })

  it('returns the shared "anonymous" bucket when no IP headers are present', () => {
    const req = new NextRequest("http://localhost/api/test")
    expect(getClientIdentifier(req)).toBe("anonymous")
  })

  // Regression: next-kit <= 0.1.1 read cf-connecting-ip unconditionally. There is
  // no Cloudflare in front of this app, so that header is client-controlled here
  // and a caller could mint a fresh rate-limit bucket per request by rotating it.
  // Declaring platform: "vercel" keeps it out of the trusted set.
  it("ignores a client-supplied cf-connecting-ip", () => {
    const headers = { "x-forwarded-for": "1.1.1.1, 2.2.2.2" }
    const honest = new NextRequest("http://localhost/api/test", { headers })
    const spoofed = new NextRequest("http://localhost/api/test", {
      headers: { ...headers, "cf-connecting-ip": "6.6.6.6" },
    })
    expect(getClientIdentifier(spoofed)).toBe(getClientIdentifier(honest))
    expect(getClientIdentifier(spoofed)).not.toBe("6.6.6.6")
  })

  it("a rotating cf-connecting-ip cannot mint new buckets", () => {
    const ids = ["9.9.9.9", "8.8.8.8", "7.7.7.7"].map((ip) =>
      getClientIdentifier(
        new NextRequest("http://localhost/api/test", {
          headers: { "x-real-ip": "5.5.5.5", "cf-connecting-ip": ip },
        })
      )
    )
    expect(new Set(ids).size).toBe(1)
    expect(ids[0]).toBe("5.5.5.5")
  })
})

describe("InMemoryRateLimiter (direct)", () => {
  it("allows requests under the limit", async () => {
    const limiter = new InMemoryRateLimiter(3, 60_000)
    const id = `allow-${Date.now()}`
    expect(await limiter.check(id)).toBe(true)
    expect(await limiter.check(id)).toBe(true)
    expect(await limiter.check(id)).toBe(true)
  })

  it("blocks requests over the limit", async () => {
    const limiter = new InMemoryRateLimiter(3, 60_000)
    const id = `block-${Date.now()}`
    await limiter.check(id)
    await limiter.check(id)
    await limiter.check(id)
    expect(await limiter.check(id)).toBe(false)
  })

  it("tracks different identifiers independently", async () => {
    const limiter = new InMemoryRateLimiter(2, 60_000)
    const id1 = `user-a-${Date.now()}`
    const id2 = `user-b-${Date.now()}`

    await limiter.check(id1)
    await limiter.check(id1)
    expect(await limiter.check(id1)).toBe(false)

    // id2 should still have its full quota
    expect(await limiter.check(id2)).toBe(true)
  })

  it("allows requests again after the window expires", async () => {
    const limiter = new InMemoryRateLimiter(2, 100) // 100ms window
    const id = `expire-${Date.now()}`

    await limiter.check(id)
    await limiter.check(id)
    expect(await limiter.check(id)).toBe(false)

    await new Promise((resolve) => setTimeout(resolve, 150))

    expect(await limiter.check(id)).toBe(true)
  })

  it("resets the count for a specific identifier", async () => {
    const limiter = new InMemoryRateLimiter(2, 60_000)
    const id = `reset-${Date.now()}`

    await limiter.check(id)
    await limiter.check(id)
    expect(await limiter.check(id)).toBe(false)

    await limiter.reset(id)

    expect(await limiter.check(id)).toBe(true)
  })

  it("reset does not throw for unknown identifiers", async () => {
    const limiter = new InMemoryRateLimiter(5, 60_000)
    await expect(limiter.reset("nonexistent-id")).resolves.toBeUndefined()
  })

  it("cleanup removes expired entries", async () => {
    const limiter = new InMemoryRateLimiter(2, 50) // 50ms window
    const id = `cleanup-${Date.now()}`

    await limiter.check(id)
    await new Promise((resolve) => setTimeout(resolve, 100))

    await limiter.cleanup()

    // After cleanup, both slots should be available again
    expect(await limiter.check(id)).toBe(true)
    expect(await limiter.check(id)).toBe(true)
    expect(await limiter.check(id)).toBe(false)
  })

  it("cleanup does not throw on empty state", async () => {
    const limiter = new InMemoryRateLimiter(5, 60_000)
    await expect(limiter.cleanup()).resolves.toBeUndefined()
  })
})

describe("createRateLimiter (factory)", () => {
  it("creates an in-memory limiter with specified max and window (Redis mocked as null)", async () => {
    const limiter = createRateLimiter("test-limiter", 3, 60_000)
    const id = `factory-${Date.now()}`
    expect(await limiter.check(id)).toBe(true)
    expect(await limiter.check(id)).toBe(true)
    expect(await limiter.check(id)).toBe(true)
    expect(await limiter.check(id)).toBe(false)
  })
})

describe("pre-built limiter instances", () => {
  it("apiLimiter allows a new unique identifier", async () => {
    const id = `api-${Date.now()}-${Math.random()}`
    expect(await apiLimiter.check(id)).toBe(true)
  })

  it("authLimiter has a stricter limit — blocks after 5 requests", async () => {
    const id = `auth-${Date.now()}-${Math.random()}`
    for (let i = 0; i < 5; i++) {
      await authLimiter.check(id)
    }
    expect(await authLimiter.check(id)).toBe(false)
  })

  it("aiChatLimiter allows a new unique identifier", async () => {
    const id = `ai-${Date.now()}-${Math.random()}`
    expect(await aiChatLimiter.check(id)).toBe(true)
  })
})

export {}
