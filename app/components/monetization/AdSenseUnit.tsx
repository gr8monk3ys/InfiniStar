"use client"

import { useEffect, useRef } from "react"
import Script from "next/script"

import { monetizationConfig } from "@/app/lib/monetization"
import { cn } from "@/app/lib/utils"

declare global {
  interface Window {
    adsbygoogle?: Array<Record<string, unknown>>
  }
}

interface AdSenseUnitProps {
  slot: string
  className?: string
}

export function AdSenseUnit({ slot, className }: AdSenseUnitProps) {
  const adRenderedRef = useRef(false)

  useEffect(() => {
    if (!monetizationConfig.enableAdSense || !monetizationConfig.adSenseClientId || !slot) {
      return
    }

    if (adRenderedRef.current) {
      return
    }

    try {
      window.adsbygoogle = window.adsbygoogle || []
      window.adsbygoogle.push({})
      adRenderedRef.current = true
    } catch {
      // Ignore render errors in environments where AdSense is blocked.
    }
  }, [slot])

  if (!monetizationConfig.enableAdSense || !monetizationConfig.adSenseClientId || !slot) {
    return null
  }

  return (
    <>
      <Script
        id="adsense-script"
        src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${monetizationConfig.adSenseClientId}`}
        strategy="afterInteractive"
        crossOrigin="anonymous"
      />
      <ins
        className={cn("adsbygoogle block w-full overflow-hidden", className)}
        style={{ display: "block" }}
        data-ad-client={monetizationConfig.adSenseClientId}
        data-ad-slot={slot}
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </>
  )
}
