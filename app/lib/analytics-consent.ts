// app/lib/analytics-consent.ts
// Single source of truth for whether the user has consented to product analytics.
// Stored in localStorage so the choice survives reloads; read defensively because
// localStorage can throw in SSR, private mode, or when cookies/storage are blocked.

export const ANALYTICS_CONSENT_STORAGE_KEY = "infinistar_analytics_consent"

export function hasAnalyticsConsent(): boolean {
  try {
    if (typeof window === "undefined") {
      return false
    }
    return window.localStorage.getItem(ANALYTICS_CONSENT_STORAGE_KEY) === "1"
  } catch {
    return false
  }
}

export function setAnalyticsConsent(granted: boolean): void {
  try {
    if (typeof window === "undefined") {
      return
    }
    if (granted) {
      window.localStorage.setItem(ANALYTICS_CONSENT_STORAGE_KEY, "1")
    } else {
      window.localStorage.removeItem(ANALYTICS_CONSENT_STORAGE_KEY)
    }
  } catch {
    // Storage unavailable (private mode / blocked) — treat as no-op.
  }
}
