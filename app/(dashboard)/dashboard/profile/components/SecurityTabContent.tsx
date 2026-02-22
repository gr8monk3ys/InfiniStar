"use client"

import { useCallback, useEffect, useState } from "react"
import dynamic from "next/dynamic"

import { api } from "@/app/lib/api-client"

const TwoFactorSettings = dynamic(
  () =>
    import("@/app/components/TwoFactorSettings").then((mod) => ({
      default: mod.TwoFactorSettings,
    })),
  {
    loading: () => <div className="h-48 animate-pulse rounded-lg bg-muted" />,
    ssr: false,
  }
)

export function SecurityTabContent() {
  const [hasPassword, setHasPassword] = useState(false)

  const checkHasPassword = useCallback(async () => {
    try {
      const response = await api.get<{ hasPassword: boolean }>("/api/profile", {
        showErrorToast: false,
      })
      setHasPassword(response.hasPassword)
    } catch {
      setHasPassword(false)
    }
  }, [])

  useEffect(() => {
    checkHasPassword()
  }, [checkHasPassword])

  return (
    <div className="space-y-6" aria-label="Security settings section">
      <div>
        <h3 className="text-lg font-medium text-foreground">Two-Factor Authentication</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Add an extra layer of security to your account by requiring a verification code in
          addition to your password when signing in.
        </p>
      </div>
      <TwoFactorSettings hasPassword={hasPassword} />
    </div>
  )
}
