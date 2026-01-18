import { NextResponse, type NextRequest } from "next/server"

import { getCorsHeaders, handleCorsPreflightRequest } from "@/app/lib/cors"

export function middleware(request: NextRequest) {
  const origin = request.headers.get("origin")

  // Handle CORS preflight requests (OPTIONS)
  if (request.method === "OPTIONS") {
    return handleCorsPreflightRequest(origin)
  }

  const response = NextResponse.next()

  // Add CORS headers
  const corsHeaders = getCorsHeaders(origin)
  Object.entries(corsHeaders).forEach(([key, value]) => {
    response.headers.set(key, value)
  })

  // Add security headers
  const headers = response.headers

  // Content Security Policy
  headers.set(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-eval' 'unsafe-inline'", // Next.js requires unsafe-eval in dev
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https: blob:",
      "font-src 'self' data:",
      "connect-src 'self' https:",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; ")
  )

  // Prevent clickjacking
  headers.set("X-Frame-Options", "DENY")

  // Prevent MIME type sniffing
  headers.set("X-Content-Type-Options", "nosniff")

  // Enable XSS protection
  headers.set("X-XSS-Protection", "1; mode=block")

  // Referrer policy
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin")

  // Permissions policy
  headers.set(
    "Permissions-Policy",
    ["camera=()", "microphone=()", "geolocation=()", "payment=()", "usb=()"].join(", ")
  )

  // HSTS (HTTP Strict Transport Security) - only in production
  if (process.env.NODE_ENV === "production") {
    headers.set("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload")
  }

  return response
}

// Configure which routes to run middleware on
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}
