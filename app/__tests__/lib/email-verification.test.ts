import {
  generateResetToken,
  generateVerificationToken,
  getResetPasswordUrl,
  getResetTokenExpiry,
  getTokenExpiry,
  getVerificationUrl,
  isTokenExpired,
} from "@/app/lib/email-verification"

describe("Email Verification Utilities", () => {
  describe("generateVerificationToken", () => {
    it("should generate a 64-character hex string", () => {
      const token = generateVerificationToken()
      expect(token).toHaveLength(64)
      expect(token).toMatch(/^[a-f0-9]+$/)
    })

    it("should generate unique tokens", () => {
      const tokens = new Set<string>()
      for (let i = 0; i < 100; i++) {
        tokens.add(generateVerificationToken())
      }
      expect(tokens.size).toBe(100)
    })

    it("should be cryptographically random", () => {
      const token1 = generateVerificationToken()
      const token2 = generateVerificationToken()
      expect(token1).not.toBe(token2)
    })
  })

  describe("generateResetToken", () => {
    it("should generate a 64-character hex string", () => {
      const token = generateResetToken()
      expect(token).toHaveLength(64)
      expect(token).toMatch(/^[a-f0-9]+$/)
    })

    it("should generate unique tokens", () => {
      const tokens = new Set<string>()
      for (let i = 0; i < 100; i++) {
        tokens.add(generateResetToken())
      }
      expect(tokens.size).toBe(100)
    })
  })

  describe("getTokenExpiry", () => {
    it("should return a date 24 hours in the future", () => {
      const before = new Date()
      const expiry = getTokenExpiry()
      const after = new Date()

      // Should be approximately 24 hours from now
      const expectedMin = before.getTime() + 24 * 60 * 60 * 1000 - 1000
      const expectedMax = after.getTime() + 24 * 60 * 60 * 1000 + 1000

      expect(expiry.getTime()).toBeGreaterThanOrEqual(expectedMin)
      expect(expiry.getTime()).toBeLessThanOrEqual(expectedMax)
    })

    it("should return a Date object", () => {
      const expiry = getTokenExpiry()
      expect(expiry).toBeInstanceOf(Date)
    })

    it("should be in the future", () => {
      const now = new Date()
      const expiry = getTokenExpiry()
      expect(expiry.getTime()).toBeGreaterThan(now.getTime())
    })
  })

  describe("getResetTokenExpiry", () => {
    it("should return a date 1 hour in the future", () => {
      const before = new Date()
      const expiry = getResetTokenExpiry()
      const after = new Date()

      // Should be approximately 1 hour from now
      const expectedMin = before.getTime() + 60 * 60 * 1000 - 1000
      const expectedMax = after.getTime() + 60 * 60 * 1000 + 1000

      expect(expiry.getTime()).toBeGreaterThanOrEqual(expectedMin)
      expect(expiry.getTime()).toBeLessThanOrEqual(expectedMax)
    })

    it("should be shorter than verification token expiry", () => {
      const resetExpiry = getResetTokenExpiry()
      const verificationExpiry = getTokenExpiry()
      expect(resetExpiry.getTime()).toBeLessThan(verificationExpiry.getTime())
    })
  })

  describe("isTokenExpired", () => {
    it("should return true for null expiry date", () => {
      expect(isTokenExpired(null)).toBe(true)
    })

    it("should return true for past date", () => {
      const pastDate = new Date()
      pastDate.setHours(pastDate.getHours() - 1)
      expect(isTokenExpired(pastDate)).toBe(true)
    })

    it("should return false for future date", () => {
      const futureDate = new Date()
      futureDate.setHours(futureDate.getHours() + 1)
      expect(isTokenExpired(futureDate)).toBe(false)
    })

    it("should return true for current date (edge case)", () => {
      // Create a date that's very slightly in the past
      const now = new Date()
      now.setMilliseconds(now.getMilliseconds() - 10)
      expect(isTokenExpired(now)).toBe(true)
    })

    it("should handle dates from getTokenExpiry", () => {
      const expiry = getTokenExpiry()
      expect(isTokenExpired(expiry)).toBe(false)
    })

    it("should handle dates from getResetTokenExpiry", () => {
      const expiry = getResetTokenExpiry()
      expect(isTokenExpired(expiry)).toBe(false)
    })
  })

  describe("getVerificationUrl", () => {
    const originalEnv = process.env.NEXT_PUBLIC_APP_URL

    beforeEach(() => {
      // Reset environment variable
      delete process.env.NEXT_PUBLIC_APP_URL
    })

    afterAll(() => {
      // Restore original value
      if (originalEnv) {
        process.env.NEXT_PUBLIC_APP_URL = originalEnv
      }
    })

    it("should use localhost as default base URL", () => {
      const token = "test-token-123"
      const url = getVerificationUrl(token)
      expect(url).toBe("http://localhost:3000/verify-email?token=test-token-123")
    })

    it("should use environment variable when set", () => {
      process.env.NEXT_PUBLIC_APP_URL = "https://example.com"
      const token = "test-token-456"
      const url = getVerificationUrl(token)
      expect(url).toBe("https://example.com/verify-email?token=test-token-456")
    })

    it("should include the full token in the URL", () => {
      const token = generateVerificationToken()
      const url = getVerificationUrl(token)
      expect(url).toContain(token)
    })

    it("should create a valid URL structure", () => {
      const token = "abc123"
      const url = getVerificationUrl(token)
      expect(url).toMatch(/^https?:\/\/.+\/verify-email\?token=.+$/)
    })
  })

  describe("getResetPasswordUrl", () => {
    const originalEnv = process.env.NEXT_PUBLIC_APP_URL

    beforeEach(() => {
      delete process.env.NEXT_PUBLIC_APP_URL
    })

    afterAll(() => {
      if (originalEnv) {
        process.env.NEXT_PUBLIC_APP_URL = originalEnv
      }
    })

    it("should use localhost as default base URL", () => {
      const token = "reset-token-123"
      const url = getResetPasswordUrl(token)
      expect(url).toBe("http://localhost:3000/reset-password?token=reset-token-123")
    })

    it("should use environment variable when set", () => {
      process.env.NEXT_PUBLIC_APP_URL = "https://app.example.com"
      const token = "reset-token-456"
      const url = getResetPasswordUrl(token)
      expect(url).toBe("https://app.example.com/reset-password?token=reset-token-456")
    })

    it("should include the full token in the URL", () => {
      const token = generateResetToken()
      const url = getResetPasswordUrl(token)
      expect(url).toContain(token)
    })

    it("should create a valid URL structure", () => {
      const token = "xyz789"
      const url = getResetPasswordUrl(token)
      expect(url).toMatch(/^https?:\/\/.+\/reset-password\?token=.+$/)
    })
  })
})

describe("Token Security", () => {
  it("should generate tokens of sufficient entropy", () => {
    // 32 bytes = 256 bits of entropy
    const token = generateVerificationToken()
    // Hex encoding doubles the length: 32 bytes * 2 = 64 characters
    expect(token.length).toBe(64)
  })

  it("should not generate predictable patterns", () => {
    const tokens: string[] = []
    for (let i = 0; i < 10; i++) {
      tokens.push(generateVerificationToken())
    }

    // Check that tokens don't share common prefixes
    const prefixes = tokens.map((t) => t.substring(0, 4))
    const uniquePrefixes = new Set(prefixes)
    expect(uniquePrefixes.size).toBeGreaterThan(5) // Most should be unique
  })

  it("should generate tokens suitable for URL parameters", () => {
    const token = generateVerificationToken()
    // Should only contain URL-safe hex characters
    expect(token).toMatch(/^[a-f0-9]+$/i)
    // Should not need URL encoding
    expect(encodeURIComponent(token)).toBe(token)
  })
})
