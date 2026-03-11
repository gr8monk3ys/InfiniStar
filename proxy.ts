import { NextResponse, type NextRequest } from "next/server"
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server"

import { getCorsHeaders, handleCorsPreflightRequest } from "@/app/lib/cors"

const isProtectedRoute = createRouteMatcher(["/dashboard(.*)"])
const shouldBypassClerkHandshake =
  process.env.SKIP_CLERK_AUTH_HANDSHAKE === "1" || process.env.SKIP_CLERK_AUTH_HANDSHAKE === "true"

function applyCorsHeaders(response: Response, origin: string | null) {
  const corsHeaders = getCorsHeaders(origin)
  Object.entries(corsHeaders).forEach(([key, value]) => {
    response.headers.set(key, value)
  })
}

export default async function proxy(request: NextRequest) {
  const origin = request.headers.get("origin")

  if (request.method === "OPTIONS") {
    return handleCorsPreflightRequest(origin)
  }

  const clerkHandler = clerkMiddleware(async (auth, req) => {
    if (isProtectedRoute(req)) {
      await auth.protect()
    }
  })

  const clerkResponse = await clerkHandler(request, {} as never)

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

  if (clerkResponse?.status === 307 || clerkResponse?.status === 302) {
    return clerkResponse
  }

  const response = clerkResponse || NextResponse.next()
  applyCorsHeaders(response, origin)

  return response
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
}
