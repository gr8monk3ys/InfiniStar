"use client"

import { useState } from "react"
import Link from "next/link"

import { setAnalyticsConsent } from "@/app/lib/analytics-consent"

const STORAGE_KEY = "infinistar_cookie_notice_dismissed"

// localStorage throws in private mode or when storage is blocked; a banner
// that cannot remember its dismissal should still render and still dismiss.
function readDismissed(): boolean {
  try {
    return Boolean(window.localStorage.getItem(STORAGE_KEY))
  } catch {
    return false
  }
}

function writeDismissed(): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, "1")
  } catch {
    // Storage unavailable — the banner hides for this page view only.
  }
}

// Rendered client-only (ClientShell loads it with `ssr: false`), so the stored
// flag can be read in the state initializer instead of a mount effect.
export function CookieBanner() {
  const [visible, setVisible] = useState(() => !readDismissed())

  function dismiss() {
    writeDismissed()
    setAnalyticsConsent(true)
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div
      role="region"
      aria-label="Cookie notice"
      className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur supports-[backdrop-filter]:bg-background/80"
    >
      <div className="container flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          We use cookies for authentication and to keep the app running.{" "}
          <Link href="/privacy" className="underline underline-offset-2 hover:text-foreground">
            Privacy Policy
          </Link>
        </p>
        <button
          type="button"
          onClick={dismiss}
          className="shrink-0 rounded-md bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Got It
        </button>
      </div>
    </div>
  )
}
