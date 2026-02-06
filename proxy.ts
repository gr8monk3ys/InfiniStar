import { NextResponse, type NextRequest } from "next/server"

import { getCorsHeaders, handleCorsPreflightRequest } from "@/app/lib/cors"

export function proxy(request: NextRequest) {
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
  // Note: Next.js requires 'unsafe-inline' for styles and inline scripts
  // In production, consider implementing nonce-based CSP with next-safe-headers
  // or using Next.js built-in CSP support (experimental feature)
  //
  // Security trade-offs:
  // - 'unsafe-eval': Required for Next.js development mode hot reload
  // - 'unsafe-inline': Required for Next.js inline scripts and styled-jsx
  //
  // For stricter CSP in production:
  // 1. Use nonce-based CSP (requires server-side nonce generation per request)
  // 2. Or use 'strict-dynamic' with hash-based CSP for known inline scripts

  const isDevelopment = process.env.NODE_ENV === "development"

  // Use stricter CSP in production (no unsafe-eval)
  const scriptSrc = isDevelopment
    ? "script-src 'self' 'unsafe-eval' 'unsafe-inline'"
    : "script-src 'self' 'unsafe-inline'" // Production: no unsafe-eval

  headers.set(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      scriptSrc,
      "style-src 'self' 'unsafe-inline'", // Required for styled-jsx and inline styles
      "img-src 'self' data: https: blob:",
      "font-src 'self' data:",
      "connect-src 'self' https: wss:", // Added wss: for Pusher WebSocket connections
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "upgrade-insecure-requests", // Force HTTPS for all requests
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
