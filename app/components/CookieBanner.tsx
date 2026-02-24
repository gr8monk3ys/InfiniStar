"use client"

import { useEffect, useState } from "react"
import Link from "next/link"

const STORAGE_KEY = "infinistar_cookie_notice_dismissed"

export function CookieBanner() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!localStorage.getItem(STORAGE_KEY)) {
      setVisible(true)
    }
  }, [])

  function dismiss() {
    localStorage.setItem(STORAGE_KEY, "1")
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="container flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          We use cookies for authentication and to keep the app running.{" "}
          <Link href="/privacy" className="underline underline-offset-2 hover:text-foreground">
            Privacy Policy
          </Link>
        </p>
        <button
          onClick={dismiss}
          className="shrink-0 rounded-md bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Got it
        </button>
      </div>
    </div>
  )
}
