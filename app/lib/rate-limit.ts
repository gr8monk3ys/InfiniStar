import { NextResponse, type NextRequest } from "next/server"

// Simple in-memory rate limiter
// For production, use Redis or a similar persistent store
class RateLimiter {
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
export const apiLimiter = new RateLimiter(60, 60000) // 60 requests per minute
export const authLimiter = new RateLimiter(5, 300000) // 5 requests per 5 minutes
export const aiChatLimiter = new RateLimiter(20, 60000) // 20 AI requests per minute

// Cleanup old entries every 5 minutes
setInterval(() => {
  apiLimiter.cleanup()
  authLimiter.cleanup()
  aiChatLimiter.cleanup()
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
export function withRateLimit(
  limiter: RateLimiter,
  handler: (request: NextRequest) => Promise<NextResponse>
) {
  return async (request: NextRequest): Promise<NextResponse> => {
    const identifier = getClientIdentifier(request)

    if (!limiter.check(identifier)) {
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
