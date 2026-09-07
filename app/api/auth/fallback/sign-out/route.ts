import { NextResponse, type NextRequest } from "next/server"

import { getCsrfTokenFromRequest, verifyCsrfToken } from "@/app/lib/csrf"
import {
  clearFallbackSessionCookie,
  getFallbackSessionTokenFromCookies,
  isFallbackAuthEnabled,
  revokeFallbackSessionByToken,
} from "@/app/lib/fallback-auth"
import { authLimiter, getClientIdentifier } from "@/app/lib/rate-limit"

export async function POST(request: NextRequest) {
  if (!isFallbackAuthEnabled()) {
    return NextResponse.json({ error: "Backup auth is not enabled." }, { status: 404 })
  }

  if (!verifyCsrfToken(request.headers.get("X-CSRF-Token"), getCsrfTokenFromRequest(request))) {
    return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 })
  }

  // Keyed on the client, because sign-out resolves no user. This route verified
  // CSRF and had no limiter — the shape ADR-0003 exists to make detectable.
  if (!(await Promise.resolve(authLimiter.check(getClientIdentifier(request))))) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429, headers: { "Retry-After": "60" } }
    )
  }

  const sessionToken = await getFallbackSessionTokenFromCookies()
  await revokeFallbackSessionByToken(sessionToken)

  const response = NextResponse.json({ success: true })
  clearFallbackSessionCookie(response)

  return response
}
