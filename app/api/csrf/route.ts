import { NextResponse, type NextRequest } from "next/server"

import { createCsrfCookie, generateCsrfToken } from "@/app/lib/csrf"
import { csrfLimiter, getClientIdentifier } from "@/app/lib/rate-limit"

/**
 * CSRF Token Endpoint
 *
 * GET /api/csrf
 * Returns a new CSRF token and sets it as an HTTP-only cookie
 */
export async function GET(request: NextRequest) {
  // Rate limiting — prevent token-generation floods
  const identifier = getClientIdentifier(request)
  const allowed = await Promise.resolve(csrfLimiter.check(identifier))
  if (!allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      {
        status: 429,
        headers: { "Retry-After": "60" },
      }
    )
  }

  const token = generateCsrfToken()

  const response = NextResponse.json({
    token,
    message: "CSRF token generated",
  })

  // Set the token as an HTTP-only cookie
  response.headers.set("Set-Cookie", createCsrfCookie(token))

  return response
}
