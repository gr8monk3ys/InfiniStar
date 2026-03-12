import { NextResponse, type NextRequest } from "next/server"

import { getCsrfTokenFromRequest, verifyCsrfToken } from "@/app/lib/csrf"
import {
  clearFallbackSessionCookie,
  getFallbackSessionTokenFromCookies,
  isFallbackAuthEnabled,
  revokeFallbackSessionByToken,
} from "@/app/lib/fallback-auth"

export async function POST(request: NextRequest) {
  if (!isFallbackAuthEnabled()) {
    return NextResponse.json({ error: "Backup auth is not enabled." }, { status: 404 })
  }

  if (!verifyCsrfToken(request.headers.get("X-CSRF-Token"), getCsrfTokenFromRequest(request))) {
    return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 })
  }

  const sessionToken = await getFallbackSessionTokenFromCookies()
  await revokeFallbackSessionByToken(sessionToken)

  const response = NextResponse.json({ success: true })
  clearFallbackSessionCookie(response)

  return response
}
