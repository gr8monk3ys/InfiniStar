import { NextResponse, type NextRequest } from "next/server"
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server"

import { getCorsHeaders, handleCorsPreflightRequest } from "@/app/lib/cors"

const isProtectedRoute = createRouteMatcher(["/dashboard(.*)"])
const shouldBypassClerkHandshake =
  process.env.SKIP_CLERK_AUTH_HANDSHAKE === "1" || process.env.SKIP_CLERK_AUTH_HANDSHAKE === "true"

function applyCorsHeaders(response: Response, origin: string | null) {
  // Add CORS headers
  const corsHeaders = getCorsHeaders(origin)
  Object.entries(corsHeaders).forEach(([key, value]) => {
    response.headers.set(key, value)
  })
}

export async function proxy(request: NextRequest) {
  const origin = request.headers.get("origin")

  // Handle CORS preflight requests (OPTIONS)
  if (request.method === "OPTIONS") {
    return handleCorsPreflightRequest(origin)
  }

  // Run Clerk middleware for auth protection
  const clerkHandler = clerkMiddleware(async (auth, req) => {
    if (isProtectedRoute(req)) {
      await auth.protect()
    }
  })

  const clerkResponse = await clerkHandler(request, {} as never)

  // Local E2E runs can use placeholder Clerk keys; skip only the dev-browser handshake redirect.
  if (
    shouldBypassClerkHandshake &&
    (clerkResponse?.status === 307 || clerkResponse?.status === 302)
  ) {
    const authReason = clerkResponse.headers.get("x-clerk-auth-reason")
    if (authReason === "dev-browser-missing" || authReason === "dev-browser-sync") {
      const response = NextResponse.next()
      clerkResponse.headers.forEach((value, key) => {
        if (key.toLowerCase().startsWith("x-clerk-")) {
          response.headers.set(key, value)
        }
      })
      applyCorsHeaders(response, origin)
      return response
    }
  }

  // If Clerk returned a redirect (unauthenticated), use it
  if (clerkResponse?.status === 307 || clerkResponse?.status === 302) {
    return clerkResponse
  }

  const response = clerkResponse || NextResponse.next()
  applyCorsHeaders(response, origin)

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
