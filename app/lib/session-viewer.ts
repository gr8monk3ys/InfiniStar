/**
 * The per-viewer facts a prerendered page needs after hydration.
 *
 * `/characters/[slug]`, `/creators/[userId]` and `/pricing` are served from
 * the ISR cache, so the HTML is the same for everyone: mature content gated,
 * the free-plan call to action, no "your plan" state. What differs per visitor
 * is answered by `/api/auth/session`, which `AuthProvider` fetches once per
 * page load anyway; this is the shape of that answer.
 *
 * Both flags default to `false`. A page must never read `true` from anywhere
 * but a confirmed session — the cookie hint can say "signed in", but it cannot
 * say "adult, opted in", and it must not be allowed to.
 */
export interface SessionViewer {
  /** `matureAccess(user).canView`: confirmed adult *and* opted in. */
  canViewMature: boolean
  /** `isProSubscription(user)`: an active PRO subscription, grace period included. */
  isPro: boolean
}

export const EMPTY_VIEWER: SessionViewer = Object.freeze({
  canViewMature: false,
  isPro: false,
})
