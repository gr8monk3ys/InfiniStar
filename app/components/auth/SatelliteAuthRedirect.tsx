"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useClerk } from "@clerk/nextjs"

import { getClerkSignInUrl, getClerkSignUpUrl } from "@/app/lib/clerk-auth"

type SatelliteAuthRedirectProps = {
  mode: "sign-in" | "sign-up"
  redirectPath: string
}

export function SatelliteAuthRedirect({ mode, redirectPath }: SatelliteAuthRedirectProps) {
  const clerk = useClerk()
  const [targetUrl, setTargetUrl] = useState(() =>
    mode === "sign-in" ? getClerkSignInUrl() : getClerkSignUpUrl()
  )

  useEffect(() => {
    const redirectUrl = new URL(redirectPath, window.location.origin).toString()
    const nextTargetUrl =
      mode === "sign-in"
        ? clerk.buildSignInUrl({ redirectUrl })
        : clerk.buildSignUpUrl({ redirectUrl })

    setTargetUrl(nextTargetUrl)
    window.location.replace(nextTargetUrl)
  }, [clerk, mode, redirectPath])

  return (
    <div className="space-y-4 text-sm text-muted-foreground">
      <p>Redirecting to the secure account portal…</p>
      <p>
        If you are not redirected automatically,{" "}
        <Link href={targetUrl} className="font-medium text-primary hover:text-primary/80">
          continue here
        </Link>
        .
      </p>
    </div>
  )
}
