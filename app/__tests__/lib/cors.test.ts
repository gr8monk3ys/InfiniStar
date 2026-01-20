/**
 * @jest-environment jsdom
 */

import {
  CORS_CONFIG,
  getAllowedOrigins,
  getCorsHeaders,
  handleCorsPreflightRequest,
  isOriginAllowed,
} from "@/app/lib/cors"

describe("CORS Configuration", () => {
  const originalEnv = process.env

  beforeEach(() => {
    // Reset environment before each test
    jest.resetModules()
    process.env = { ...originalEnv }
  })

  afterAll(() => {
    // Restore original environment
    process.env = originalEnv
  })

  describe("getAllowedOrigins", () => {
    it("should return localhost origins in development", () => {
      ;(process.env as Record<string, string>).NODE_ENV = "development"
      const origins = getAllowedOrigins()
      expect(origins).toContain("http://localhost:3000")
      expect(origins).toContain("http://localhost:3001")
      expect(origins).toContain("http://127.0.0.1:3000")
    })

    it("should return app URL in production", () => {
      ;(process.env as Record<string, string>).NODE_ENV = "production"
      process.env.NEXT_PUBLIC_APP_URL = "https://example.com"
      const origins = getAllowedOrigins()
      expect(origins).toEqual(["https://example.com"])
    })

    it("should return empty array if no app URL in production", () => {
      ;(process.env as Record<string, string>).NODE_ENV = "production"
      delete process.env.NEXT_PUBLIC_APP_URL
      const origins = getAllowedOrigins()
      expect(origins).toEqual([])
    })
  })

  describe("isOriginAllowed", () => {
    it("should allow same-origin requests (no origin header)", () => {
      expect(isOriginAllowed(null)).toBe(true)
    })

    it("should allow localhost in development", () => {
      ;(process.env as Record<string, string>).NODE_ENV = "development"
      expect(isOriginAllowed("http://localhost:3000")).toBe(true)
      expect(isOriginAllowed("http://localhost:3001")).toBe(true)
      expect(isOriginAllowed("http://127.0.0.1:3000")).toBe(true)
    })

    it("should allow .local domains in development", () => {
      ;(process.env as Record<string, string>).NODE_ENV = "development"
      expect(isOriginAllowed("http://myapp.local")).toBe(true)
    })

    it("should reject non-localhost origins in development", () => {
      ;(process.env as Record<string, string>).NODE_ENV = "development"
      expect(isOriginAllowed("https://malicious.com")).toBe(false)
    })

    it("should only allow configured app URL in production", () => {
      ;(process.env as Record<string, string>).NODE_ENV = "production"
      process.env.NEXT_PUBLIC_APP_URL = "https://example.com"
      expect(isOriginAllowed("https://example.com")).toBe(true)
      expect(isOriginAllowed("https://other.com")).toBe(false)
    })

    it("should handle invalid URLs gracefully", () => {
      ;(process.env as Record<string, string>).NODE_ENV = "development"
      expect(isOriginAllowed("not-a-valid-url")).toBe(false)
    })
  })

  describe("getCorsHeaders", () => {
    it("should return CORS headers for allowed origin", () => {
      ;(process.env as Record<string, string>).NODE_ENV = "development"
      const headers = getCorsHeaders("http://localhost:3000")

      expect(headers["Access-Control-Allow-Origin"]).toBe("http://localhost:3000")
      expect(headers["Access-Control-Allow-Credentials"]).toBe("true")
      expect(headers["Access-Control-Allow-Methods"]).toContain("GET")
      expect(headers["Access-Control-Allow-Methods"]).toContain("POST")
      expect(headers["Access-Control-Allow-Headers"]).toContain("Content-Type")
      expect(headers["Access-Control-Allow-Headers"]).toContain("X-CSRF-Token")
      expect(headers["Vary"]).toBe("Origin")
    })

    it("should return empty object for disallowed origin", () => {
      ;(process.env as Record<string, string>).NODE_ENV = "production"
      process.env.NEXT_PUBLIC_APP_URL = "https://example.com"
      const headers = getCorsHeaders("https://malicious.com")

      expect(Object.keys(headers).length).toBe(0)
    })

    it("should respect custom options", () => {
      ;(process.env as Record<string, string>).NODE_ENV = "development"
      const headers = getCorsHeaders("http://localhost:3000", {
        allowCredentials: false,
        maxAge: 3600,
        allowedMethods: ["GET", "POST"],
        allowedHeaders: ["Content-Type"],
        exposedHeaders: ["X-Custom-Header"],
      })

      expect(headers["Access-Control-Allow-Credentials"]).toBeUndefined()
      expect(headers["Access-Control-Max-Age"]).toBe("3600")
      expect(headers["Access-Control-Allow-Methods"]).toBe("GET, POST")
      expect(headers["Access-Control-Allow-Headers"]).toBe("Content-Type")
      expect(headers["Access-Control-Expose-Headers"]).toBe("X-Custom-Header")
    })

    it("should set max-age header", () => {
      ;(process.env as Record<string, string>).NODE_ENV = "development"
      const headers = getCorsHeaders("http://localhost:3000")

      expect(headers["Access-Control-Max-Age"]).toBe("86400")
    })
  })

  describe("handleCorsPreflightRequest", () => {
    it("should return 204 for allowed origin", () => {
      ;(process.env as Record<string, string>).NODE_ENV = "development"
      const response = handleCorsPreflightRequest("http://localhost:3000")

      expect(response.status).toBe(204)
      expect(response.headers.get("Access-Control-Allow-Origin")).toBe("http://localhost:3000")
    })

    it("should return 403 for disallowed origin", () => {
      ;(process.env as Record<string, string>).NODE_ENV = "production"
      process.env.NEXT_PUBLIC_APP_URL = "https://example.com"
      const response = handleCorsPreflightRequest("https://malicious.com")

      expect(response.status).toBe(403)
    })
  })

  describe("CORS_CONFIG constants", () => {
    it("should define standard CORS methods", () => {
      expect(CORS_CONFIG.CORS_METHODS).toContain("GET")
      expect(CORS_CONFIG.CORS_METHODS).toContain("POST")
      expect(CORS_CONFIG.CORS_METHODS).toContain("PUT")
      expect(CORS_CONFIG.CORS_METHODS).toContain("PATCH")
      expect(CORS_CONFIG.CORS_METHODS).toContain("DELETE")
      expect(CORS_CONFIG.CORS_METHODS).toContain("OPTIONS")
    })

    it("should define allowed headers", () => {
      expect(CORS_CONFIG.ALLOWED_HEADERS).toContain("Content-Type")
      expect(CORS_CONFIG.ALLOWED_HEADERS).toContain("Authorization")
      expect(CORS_CONFIG.ALLOWED_HEADERS).toContain("X-CSRF-Token")
    })

    it("should define exposed headers", () => {
      expect(CORS_CONFIG.EXPOSED_HEADERS).toContain("X-CSRF-Token")
    })

    it("should define max age", () => {
      expect(CORS_CONFIG.MAX_AGE).toBe(86400)
    })
  })
})
