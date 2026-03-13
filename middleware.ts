import { NextResponse, type NextRequest } from "next/server"
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server"

import { FALLBACK_AUTH_COOKIE_NAME } from "@/app/lib/auth-constants"
import { getClerkSignInUrl, getClerkSignUpUrl, isClerkSatellite } from "@/app/lib/clerk-auth"
import { getCorsHeaders, handleCorsPreflightRequest } from "@/app/lib/cors"
import { isFallbackAuthEnabled } from "@/app/lib/fallback-auth"

const isProtectedRoute = createRouteMatcher(["/dashboard(.*)"])
const isClerkProxyRoute = createRouteMatcher(["/api/clerk-proxy(.*)"])
const shouldBypassClerkHandshake =
  process.env.SKIP_CLERK_AUTH_HANDSHAKE === "1" || process.env.SKIP_CLERK_AUTH_HANDSHAKE === "true"

function isClerkConfiguredOnServer() {
  return Boolean(process.env.CLERK_SECRET_KEY && process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY)
}

function applyCorsHeaders(response: Response, origin: string | null) {
  const corsHeaders = getCorsHeaders(origin)
  Object.entries(corsHeaders).forEach(([key, value]) => {
    response.headers.set(key, value)
  })
}

function buildSignInRedirect(request: NextRequest) {
  const signInUrl = new URL(getClerkSignInUrl(), request.url)
  const redirectPath = `${request.nextUrl.pathname}${request.nextUrl.search}`
  signInUrl.searchParams.set("redirect_url", redirectPath)
  return signInUrl
}

export default async function proxy(request: NextRequest) {
  const origin = request.headers.get("origin")
  const hasFallbackSession =
    isFallbackAuthEnabled() && Boolean(request.cookies.get(FALLBACK_AUTH_COOKIE_NAME)?.value)

  if (request.method === "OPTIONS") {
    return handleCorsPreflightRequest(origin)
  }

  if (isClerkProxyRoute(request)) {
    const response = NextResponse.next()
    applyCorsHeaders(response, origin)
    return response
  }

  if (!isClerkConfiguredOnServer()) {
    if (isProtectedRoute(request) && !hasFallbackSession) {
      return NextResponse.redirect(buildSignInRedirect(request))
    }

    const response = NextResponse.next()
    applyCorsHeaders(response, origin)
    return response
  }

  const clerkHandler = clerkMiddleware(
    async (auth, req) => {
      if (isProtectedRoute(req) && !hasFallbackSession) {
        await auth.protect()
      }
    },
    (req) =>
      isClerkSatellite()
        ? {
            domain: req.nextUrl.host,
            isSatellite: true,
            signInUrl: getClerkSignInUrl(),
            signUpUrl: getClerkSignUpUrl(),
          }
        : {
            proxyUrl: process.env.NEXT_PUBLIC_CLERK_PROXY_URL,
            signInUrl: getClerkSignInUrl(),
            signUpUrl: getClerkSignUpUrl(),
          }
  )

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
