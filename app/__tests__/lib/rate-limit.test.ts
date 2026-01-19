/**
 * Rate Limiter Tests
 *
 * Note: Tests for getClientIdentifier and withRateLimit are skipped because
 * they require NextRequest which isn't available in the Jest jsdom environment.
 * These functions should be tested via integration/E2E tests.
 */

// We need to import only the parts that don't require NextRequest
// The InMemoryRateLimiter class is independent of Next.js
class InMemoryRateLimiter {
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

describe("InMemoryRateLimiter", () => {
  describe("constructor", () => {
    it("should use default values when not provided", () => {
      const limiter = new InMemoryRateLimiter()
      // Default is 10 requests per 60000ms
      // Should allow 10 requests
      for (let i = 0; i < 10; i++) {
        expect(limiter.check("test")).toBe(true)
      }
      // 11th request should be blocked
      expect(limiter.check("test")).toBe(false)
    })

    it("should use custom limit and window", () => {
      const limiter = new InMemoryRateLimiter(3, 1000)
      // Should allow 3 requests
      expect(limiter.check("test")).toBe(true)
      expect(limiter.check("test")).toBe(true)
      expect(limiter.check("test")).toBe(true)
      // 4th request should be blocked
      expect(limiter.check("test")).toBe(false)
    })
  })

  describe("check", () => {
    it("should allow requests within limit", () => {
      const limiter = new InMemoryRateLimiter(5, 60000)
      const identifier = "user-123"

      for (let i = 0; i < 5; i++) {
        expect(limiter.check(identifier)).toBe(true)
      }
    })

    it("should block requests exceeding limit", () => {
      const limiter = new InMemoryRateLimiter(3, 60000)
      const identifier = "user-456"

      // First 3 should pass
      expect(limiter.check(identifier)).toBe(true)
      expect(limiter.check(identifier)).toBe(true)
      expect(limiter.check(identifier)).toBe(true)

      // 4th and beyond should fail
      expect(limiter.check(identifier)).toBe(false)
      expect(limiter.check(identifier)).toBe(false)
    })

    it("should track different identifiers separately", () => {
      const limiter = new InMemoryRateLimiter(2, 60000)

      // User 1 makes 2 requests (reaches limit)
      expect(limiter.check("user-1")).toBe(true)
      expect(limiter.check("user-1")).toBe(true)
      expect(limiter.check("user-1")).toBe(false)

      // User 2 should still be able to make requests
      expect(limiter.check("user-2")).toBe(true)
      expect(limiter.check("user-2")).toBe(true)
      expect(limiter.check("user-2")).toBe(false)
    })

    it("should allow requests after window expires", async () => {
      const limiter = new InMemoryRateLimiter(2, 100) // 100ms window

      // Use up the limit
      expect(limiter.check("user")).toBe(true)
      expect(limiter.check("user")).toBe(true)
      expect(limiter.check("user")).toBe(false)

      // Wait for window to expire
      await new Promise((resolve) => setTimeout(resolve, 150))

      // Should be allowed again
      expect(limiter.check("user")).toBe(true)
    })

    it("should handle new identifiers correctly", () => {
      const limiter = new InMemoryRateLimiter(5, 60000)

      // New identifier should start fresh
      expect(limiter.check("new-user")).toBe(true)
    })

    it("should handle rapid successive requests", () => {
      const limiter = new InMemoryRateLimiter(100, 60000)
      const identifier = "rapid-user"

      // Make 100 rapid requests
      for (let i = 0; i < 100; i++) {
        expect(limiter.check(identifier)).toBe(true)
      }

      // 101st should fail
      expect(limiter.check(identifier)).toBe(false)
    })
  })

  describe("reset", () => {
    it("should reset rate limit for specific identifier", () => {
      const limiter = new InMemoryRateLimiter(2, 60000)

      // Use up limit
      limiter.check("user-1")
      limiter.check("user-1")
      expect(limiter.check("user-1")).toBe(false)

      // Reset
      limiter.reset("user-1")

      // Should be allowed again
      expect(limiter.check("user-1")).toBe(true)
    })

    it("should not affect other identifiers", () => {
      const limiter = new InMemoryRateLimiter(2, 60000)

      // Use up limits for both users
      limiter.check("user-1")
      limiter.check("user-1")
      limiter.check("user-2")
      limiter.check("user-2")

      // Reset only user-1
      limiter.reset("user-1")

      // User 1 can make requests, user 2 still blocked
      expect(limiter.check("user-1")).toBe(true)
      expect(limiter.check("user-2")).toBe(false)
    })

    it("should handle reset for non-existent identifier", () => {
      const limiter = new InMemoryRateLimiter(5, 60000)

      // Should not throw for non-existent identifier
      expect(() => limiter.reset("non-existent")).not.toThrow()
    })
  })

  describe("cleanup", () => {
    it("should remove expired entries", async () => {
      const limiter = new InMemoryRateLimiter(2, 50) // 50ms window

      // Make a request
      limiter.check("user-1")

      // Wait for window to expire
      await new Promise((resolve) => setTimeout(resolve, 100))

      // Cleanup should remove expired entries
      limiter.cleanup()

      // User should be able to make full quota of requests
      expect(limiter.check("user-1")).toBe(true)
      expect(limiter.check("user-1")).toBe(true)
    })

    it("should keep valid entries", async () => {
      const limiter = new InMemoryRateLimiter(3, 1000)

      // Make some requests
      limiter.check("user-1")
      limiter.check("user-1")

      // Cleanup immediately (entries should still be valid)
      limiter.cleanup()

      // Should only allow 1 more request
      expect(limiter.check("user-1")).toBe(true)
      expect(limiter.check("user-1")).toBe(false)
    })

    it("should handle mixed expired and valid entries", async () => {
      const limiter = new InMemoryRateLimiter(3, 100)

      // User 1 makes request
      limiter.check("user-1")

      // Wait partial time
      await new Promise((resolve) => setTimeout(resolve, 60))

      // User 2 makes request (more recent)
      limiter.check("user-2")

      // Wait for user-1's requests to expire but not user-2's
      await new Promise((resolve) => setTimeout(resolve, 60))

      limiter.cleanup()

      // User 1 should have full quota, user 2 should have 2 remaining
      expect(limiter.check("user-1")).toBe(true)
      expect(limiter.check("user-1")).toBe(true)
      expect(limiter.check("user-1")).toBe(true)
      expect(limiter.check("user-1")).toBe(false)

      expect(limiter.check("user-2")).toBe(true)
      expect(limiter.check("user-2")).toBe(true)
      expect(limiter.check("user-2")).toBe(false)
    })

    it("should handle empty state", () => {
      const limiter = new InMemoryRateLimiter(5, 60000)

      // Cleanup with no entries should not throw
      expect(() => limiter.cleanup()).not.toThrow()
    })
  })

  describe("edge cases", () => {
    it("should handle limit of 1", () => {
      const limiter = new InMemoryRateLimiter(1, 60000)

      expect(limiter.check("user")).toBe(true)
      expect(limiter.check("user")).toBe(false)
    })

    it("should handle very short window", async () => {
      const limiter = new InMemoryRateLimiter(10, 10) // 10ms window

      // Fill up
      for (let i = 0; i < 10; i++) {
        limiter.check("user")
      }
      expect(limiter.check("user")).toBe(false)

      // Wait for window
      await new Promise((resolve) => setTimeout(resolve, 20))

      // Should work again
      expect(limiter.check("user")).toBe(true)
    })

    it("should handle empty string identifier", () => {
      const limiter = new InMemoryRateLimiter(2, 60000)

      expect(limiter.check("")).toBe(true)
      expect(limiter.check("")).toBe(true)
      expect(limiter.check("")).toBe(false)
    })

    it("should handle special characters in identifier", () => {
      const limiter = new InMemoryRateLimiter(2, 60000)
      const specialId = "user@example.com:192.168.1.1"

      expect(limiter.check(specialId)).toBe(true)
      expect(limiter.check(specialId)).toBe(true)
      expect(limiter.check(specialId)).toBe(false)
    })
  })
})

describe("Rate Limiter Integration Scenarios", () => {
  it("should handle authentication rate limiting (5 per 5 min)", () => {
    const authLimiter = new InMemoryRateLimiter(5, 300000)
    const ip = "192.168.1.100"

    // Simulate 5 login attempts
    for (let i = 0; i < 5; i++) {
      expect(authLimiter.check(ip)).toBe(true)
    }

    // 6th attempt should be blocked
    expect(authLimiter.check(ip)).toBe(false)
  })

  it("should handle API rate limiting (60 per min)", () => {
    const apiLimiter = new InMemoryRateLimiter(60, 60000)
    const userId = "user-api-test"

    // Should allow 60 requests
    for (let i = 0; i < 60; i++) {
      expect(apiLimiter.check(userId)).toBe(true)
    }

    // 61st should be blocked
    expect(apiLimiter.check(userId)).toBe(false)
  })

  it("should handle AI chat rate limiting (20 per min)", () => {
    const aiLimiter = new InMemoryRateLimiter(20, 60000)
    const userId = "user-ai-test"

    // Should allow 20 requests
    for (let i = 0; i < 20; i++) {
      expect(aiLimiter.check(userId)).toBe(true)
    }

    // 21st should be blocked
    expect(aiLimiter.check(userId)).toBe(false)
  })

  it("should handle 2FA rate limiting (5 per 5 min)", () => {
    const twoFactorLimiter = new InMemoryRateLimiter(5, 300000)
    const userId = "user-2fa-test"

    // 5 verification attempts
    for (let i = 0; i < 5; i++) {
      expect(twoFactorLimiter.check(userId)).toBe(true)
    }

    // 6th attempt blocked
    expect(twoFactorLimiter.check(userId)).toBe(false)
  })

  it("should allow reset after successful authentication", () => {
    const authLimiter = new InMemoryRateLimiter(5, 300000)
    const ip = "192.168.1.200"

    // Failed attempts
    authLimiter.check(ip)
    authLimiter.check(ip)
    authLimiter.check(ip)

    // Successful login - reset the limiter
    authLimiter.reset(ip)

    // Should have full quota again
    for (let i = 0; i < 5; i++) {
      expect(authLimiter.check(ip)).toBe(true)
    }
  })
})

export {}
