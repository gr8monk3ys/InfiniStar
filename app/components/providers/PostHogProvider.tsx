// app/components/providers/PostHogProvider.tsx
"use client"

import { useEffect } from "react"
import posthog from "posthog-js"

import { hasAnalyticsConsent } from "@/app/lib/analytics-consent"
import { config } from "@/app/lib/config"

// Boots posthog-js exactly once, only with consent and a configured key.
// Events are sent through the first-party /ingest proxy (see next.config.mjs)
// so ad-blockers that block *.posthog.com do not drop them.
export function PostHogProvider() {
  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY
    if (!key) {
      return
    }
    if (!hasAnalyticsConsent()) {
      return
    }
    if (posthog.__loaded) {
      return
    }

    posthog.init(key, {
      api_host: "/ingest",
      ui_host: config.posthog.uiHost,
      capture_pageview: true,
      persistence: "localStorage+cookie",
      autocapture: false,
    })
  }, [])

  return null
}
