"use client"

import { useEffect } from "react"

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return
    if (!("serviceWorker" in navigator)) return

    navigator.serviceWorker.register("/sw.js").catch((error) => {
      // PWA is best-effort; don't break the app if registration fails.
      console.warn("SERVICE_WORKER_REGISTER_ERROR", error)
    })
  }, [])

  return null
}
