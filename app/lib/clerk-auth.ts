import { clerkJsScriptUrl } from "@clerk/shared/loadClerkJsScript"

function isEnabled(value?: string) {
  if (!value) {
    return false
  }

  const normalized = value.trim().toLowerCase()
  return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on"
}

function getFirstValue(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value
}

export function isClerkClientConfigured() {
  return Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY)
}

export function isClerkSatellite() {
  return isEnabled(process.env.NEXT_PUBLIC_CLERK_IS_SATELLITE)
}

/**
 * Script-loading props for `<ClerkProvider>` when the proxy URL is a path.
 *
 * Preview and development set `NEXT_PUBLIC_CLERK_PROXY_URL=/api/clerk-proxy`.
 * Clerk builds the clerk-js `<script src>` from the proxy URL and resolves a
 * path against `window.location.origin` — inside render, unguarded — so the
 * first prerendered page whose tree held the provider (`/pricing`, #105)
 * failed `next build` with `ReferenceError: window is not defined`.
 * Production holds an absolute URL and never hit it, which is why the
 * production build passed and every preview build failed.
 *
 * `clerkJsScriptUrl` returns an explicit `clerkJSUrl` before it looks at the
 * proxy, so the fix is to supply one: the same URL Clerk would build, minus
 * the origin. A relative `src` resolves against whatever host serves the page
 * — a branch preview keeps proxying through its own origin — and it is the
 * same string on the server and in the browser, so nothing mismatches at
 * hydration. The version segment comes from Clerk's builder, not from here.
 *
 * `proxyUrl` is passed through unchanged; `data-clerk-proxy-url` and
 * clerk-js's runtime resolution of it are what they were.
 */
const PLACEHOLDER_ORIGIN = "https://clerk-proxy.invalid"

export function resolveClerkScriptProps(
  proxyUrl = process.env.NEXT_PUBLIC_CLERK_PROXY_URL,
  publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
): { proxyUrl?: string; clerkJSUrl?: string } {
  const value = proxyUrl?.trim()
  if (!value) {
    return {}
  }
  if (!value.startsWith("/")) {
    return { proxyUrl: value }
  }

  const absolute = clerkJsScriptUrl({
    publishableKey: publishableKey ?? "",
    proxyUrl: `${PLACEHOLDER_ORIGIN}${value}`,
  })
  if (!absolute.startsWith(PLACEHOLDER_ORIGIN)) {
    // The builder did not use the proxy (it should always, for a valid
    // absolute URL); fall back to letting Clerk decide in the browser only.
    return { proxyUrl: value }
  }

  return { proxyUrl: value, clerkJSUrl: absolute.slice(PLACEHOLDER_ORIGIN.length) }
}

export function getClerkSignInUrl() {
  return process.env.NEXT_PUBLIC_CLERK_SIGN_IN_URL || "/sign-in"
}

export function getClerkSignUpUrl() {
  return process.env.NEXT_PUBLIC_CLERK_SIGN_UP_URL || "/sign-up"
}

export function getSafePostAuthPath(value?: string | string[], fallbackPath = "/dashboard") {
  const candidate = getFirstValue(value)?.trim()

  if (!candidate) {
    return fallbackPath
  }

  if (!candidate.startsWith("/")) {
    return fallbackPath
  }

  if (candidate.startsWith("//")) {
    return fallbackPath
  }

  return candidate
}
