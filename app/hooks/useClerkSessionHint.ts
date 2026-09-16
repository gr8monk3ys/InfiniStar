"use client"

import { useSyncExternalStore } from "react"

/**
 * What the browser can know about the sign-in state before any round trip.
 *
 * Clerk's `__client_uat` cookie is deliberately not HttpOnly: it exists so the
 * client can tell whether a session exists without asking the server. It is a
 * hint, not the truth — `/api/auth/session` confirms it (and covers the
 * fallback-auth cookie, which is HttpOnly and leaves no hint) — but it is
 * enough to pick the right layout at hydration instead of flashing the
 * signed-out one at a signed-in visitor.
 *
 * Any page that reads this instead of awaiting `auth()` on the server can be
 * prerendered; that is the whole reason it exists (see `header-actions.tsx`).
 */
export type SignedInHint = "unknown" | "signed-in" | "signed-out"

function subscribe() {
  // The cookie has no change event; the session fetch is the source of truth
  // after hydration, so there is nothing to subscribe to.
  return () => {}
}

export function readClerkCookieHint(cookie: string | undefined): SignedInHint {
  if (!cookie) {
    return "unknown"
  }
  // `__client_uat=<unix seconds>` when a Clerk client has a session,
  // `__client_uat=0` when it does not. Multi-instance setups suffix the name.
  const match = /(?:^|;\s*)__client_uat(?:_[A-Za-z0-9]+)?=([^;]*)/.exec(cookie)
  if (!match) {
    return "unknown"
  }
  return match[1] && match[1] !== "0" ? "signed-in" : "signed-out"
}

function getSnapshot(): SignedInHint {
  return readClerkCookieHint(typeof document === "undefined" ? undefined : document.cookie)
}

function getServerSnapshot(): SignedInHint {
  return "unknown"
}

export function useClerkSessionHint(): SignedInHint {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
