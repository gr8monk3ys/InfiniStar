// app/components/providers/ClientShell.tsx
"use client"

import { useEffect } from "react"
import dynamic from "next/dynamic"

import {
  parseAttributionFromSearch,
  readAttributionCookie,
  serializeAttributionCookie,
} from "@/app/lib/attribution"

const CookieBanner = dynamic(
  () => import("@/app/components/CookieBanner").then((module) => module.CookieBanner),
  { ssr: false }
)
const ServiceWorkerRegister = dynamic(
  () =>
    import("@/app/components/pwa/ServiceWorkerRegister").then(
      (module) => module.ServiceWorkerRegister
    ),
  { ssr: false }
)
const ToasterContext = dynamic(() => import("@/app/context/ToasterContext"), { ssr: false })
const PostHogProvider = dynamic(
  () =>
    import("@/app/components/providers/PostHogProvider").then((module) => module.PostHogProvider),
  { ssr: false }
)

export function ClientShell() {
  useEffect(() => {
    // First-touch attribution: write the cookie only if absent (first touch wins).
    if (readAttributionCookie(document.cookie)) {
      return
    }
    const attribution = parseAttributionFromSearch(window.location.search)
    if (attribution) {
      document.cookie = serializeAttributionCookie(attribution)
    }
  }, [])

  return (
    <>
      <ToasterContext />
      <ServiceWorkerRegister />
      <PostHogProvider />
      <CookieBanner />
    </>
  )
}
