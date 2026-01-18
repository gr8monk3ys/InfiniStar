import { NextResponse } from "next/server"

import { createCsrfCookie, generateCsrfToken } from "@/app/lib/csrf"

/**
 * CSRF Token Endpoint
 *
 * GET /api/csrf
 * Returns a new CSRF token and sets it as an HTTP-only cookie
 */
export async function GET() {
  const token = generateCsrfToken()

  const response = NextResponse.json({
    token,
    message: "CSRF token generated",
  })

  // Set the token as an HTTP-only cookie
  response.headers.set("Set-Cookie", createCsrfCookie(token))

  return response
}
