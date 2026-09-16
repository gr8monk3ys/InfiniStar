"use client"

import { useEffect, useState, useSyncExternalStore } from "react"
import Link from "next/link"

import { buttonVariants } from "@/app/components/ui/button"
import { ThemeToggleCompact } from "@/app/components/theme-toggle"

/**
 * Sign-in state for the site header, resolved on the client.
 *
 * The header sits in the root layout, so anything it awaits on the server
 * (Clerk `auth()`, a session cookie) makes *every* route render per request —
 * the landing page included, which is why `/` was served with `no-store` and
 * a cold TTFB of several seconds. Reading the session here instead lets the
 * root layout, and every page under it that has no per-user data of its own,
 * be prerendered and served from the CDN.
 *
 * Three stages, so the visible result matches what the server used to render:
 * 1. The static HTML carries the signed-out buttons (the common case for a
 *    landing page, and what a signed-out visitor should see at first paint).
 * 2. At hydration, Clerk's `__client_uat` cookie — deliberately not HttpOnly,
 *    it exists so the browser can know the sign-in state without a round
 *    trip — switches a signed-in visitor to "Open App" before they can see
 *    the wrong buttons.
 * 3. `/api/auth/session` then confirms against the real session (this also
 *    covers the fallback-auth cookie, which is HttpOnly and has no hint).
 */

type SignedInState = "unknown" | "signed-in" | "signed-out"

function subscribe() {
  // The cookie hint has no change event; the fetch below is the source of
  // truth after hydration, so nothing to subscribe to.
  return () => {}
}

function readClerkCookieHint(): SignedInState {
  if (typeof document === "undefined") {
    return "unknown"
  }
  // `__client_uat=<unix seconds>` when a Clerk client has a session,
  // `__client_uat=0` when it does not. Multi-instance setups suffix the name.
  const match = /(?:^|;\s*)__client_uat(?:_[A-Za-z0-9]+)?=([^;]*)/.exec(document.cookie)
  if (!match) {
    return "unknown"
  }
  return match[1] && match[1] !== "0" ? "signed-in" : "signed-out"
}

function getServerSnapshot(): SignedInState {
  return "unknown"
}

export function HeaderActions() {
  const cookieHint = useSyncExternalStore(subscribe, readClerkCookieHint, getServerSnapshot)
  const [confirmed, setConfirmed] = useState<SignedInState>("unknown")

  useEffect(() => {
    const controller = new AbortController()

    fetch("/api/auth/session", {
      cache: "no-store",
      credentials: "include",
      signal: controller.signal,
    })
      .then((response) => (response.ok ? response.json() : null))
      .then((payload: { isSignedIn?: boolean } | null) => {
        if (payload) {
          setConfirmed(payload.isSignedIn ? "signed-in" : "signed-out")
        }
      })
      .catch(() => {
        // Network failure or an aborted unmount: keep whatever the hint said.
      })

    return () => controller.abort()
  }, [])

  const state = confirmed !== "unknown" ? confirmed : cookieHint
  const isSignedIn = state === "signed-in"

  return (
    <nav className="flex items-center space-x-2">
      <ThemeToggleCompact />
      {isSignedIn ? (
        <Link href="/dashboard" className={buttonVariants({ size: "sm", variant: "gradient" })}>
          Open App
        </Link>
      ) : (
        <>
          <Link href="/sign-in" className={buttonVariants({ size: "sm", variant: "ghost" })}>
            Sign In
          </Link>
          <Link href="/sign-up" className={buttonVariants({ size: "sm", variant: "gradient" })}>
            Create Account
          </Link>
        </>
      )}
    </nav>
  )
}
