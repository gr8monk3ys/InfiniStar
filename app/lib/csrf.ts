import { headers } from "next/headers"
import crypto from "crypto"

/**
 * CSRF Token Management
 *
 * Implements Double Submit Cookie pattern for CSRF protection.
 * Tokens are stored in HTTP-only cookies and validated on each mutation request.
 */

const CSRF_TOKEN_LENGTH = 32
const CSRF_COOKIE_NAME = "csrf-token"

/**
 * Generate a cryptographically secure CSRF token
 */
export function generateCsrfToken(): string {
  return crypto.randomBytes(CSRF_TOKEN_LENGTH).toString("hex")
}

/**
 * Verify CSRF token from request headers against cookie value
 *
 * @param headerToken - Token from X-CSRF-Token header
 * @param cookieToken - Token from csrf-token cookie
 * @returns true if tokens match, false otherwise
 */
export function verifyCsrfToken(headerToken: string | null, cookieToken: string | null): boolean {
  if (!headerToken || !cookieToken) {
    return false
  }

  // Convert to buffers
  const headerBuffer = Buffer.from(headerToken, "utf8")
  const cookieBuffer = Buffer.from(cookieToken, "utf8")

  // Check buffer lengths to prevent timing attacks from length differences
  // Use constant-time comparison even for length check
  if (headerBuffer.length !== cookieBuffer.length) {
    return false
  }

  // Use timing-safe comparison to prevent timing attacks
  try {
    return crypto.timingSafeEqual(headerBuffer, cookieBuffer)
  } catch {
    // In case of any unexpected error, fail securely
    return false
  }
}

/**
 * Get CSRF token from request cookies (server-side)
 */
export async function getCsrfTokenFromCookies(): Promise<string | null> {
  const headersList = await headers()
  const cookieHeader = headersList.get("cookie")

  if (!cookieHeader) {
    return null
  }

  const cookies = cookieHeader.split(";").reduce(
    (acc, cookie) => {
      const [key, value] = cookie.trim().split("=")
      acc[key] = value
      return acc
    },
    {} as Record<string, string>
  )

  return cookies[CSRF_COOKIE_NAME] || null
}

/**
 * Create Set-Cookie header value for CSRF token
 */
export function createCsrfCookie(
  token: string,
  options?: {
    maxAge?: number
    secure?: boolean
    sameSite?: "strict" | "lax" | "none"
  }
): string {
  const {
    maxAge = 60 * 60 * 24, // 24 hours
    secure = process.env.NODE_ENV === "production",
    sameSite = "strict",
  } = options || {}

  const cookieOptions = [
    `${CSRF_COOKIE_NAME}=${token}`,
    "HttpOnly",
    "Path=/",
    `Max-Age=${maxAge}`,
    `SameSite=${sameSite}`,
  ]

  if (secure) {
    cookieOptions.push("Secure")
  }

  return cookieOptions.join("; ")
}

/**
 * Higher-order function to wrap API routes with CSRF protection
 *
 * @example
 * export const POST = withCsrfProtection(async (request: NextRequest) => {
 *   // Your protected route logic
 * });
 */
export function withCsrfProtection<T>(
  handler: (request: Request) => Promise<T>
): (request: Request) => Promise<T | Response> {
  return async (request: Request) => {
    // Only check CSRF for state-changing methods
    const method = request.method
    if (!["POST", "PUT", "PATCH", "DELETE"].includes(method)) {
      return handler(request)
    }

    // Get tokens from header and cookie
    const headerToken = request.headers.get("X-CSRF-Token")
    const cookieHeader = request.headers.get("cookie")

    let cookieToken: string | null = null
    if (cookieHeader) {
      const cookies = cookieHeader.split(";").reduce(
        (acc, cookie) => {
          const [key, value] = cookie.trim().split("=")
          acc[key] = value
          return acc
        },
        {} as Record<string, string>
      )
      cookieToken = cookies[CSRF_COOKIE_NAME] || null
    }

    // Verify tokens match
    if (!verifyCsrfToken(headerToken, cookieToken)) {
      return new Response(
        JSON.stringify({
          error: "Invalid CSRF token",
          code: "CSRF_TOKEN_INVALID",
        }),
        {
          status: 403,
          headers: { "Content-Type": "application/json" },
        }
      )
    }

    return handler(request)
  }
}

/**
 * Constants for export
 */
export const CSRF_HEADER_NAME = "X-CSRF-Token"
export { CSRF_COOKIE_NAME }
