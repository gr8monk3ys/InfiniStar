"use client"

import { useCallback, useState } from "react"
import { toast } from "react-hot-toast"
import { HiShieldCheck, HiShieldExclamation } from "react-icons/hi2"

import { api, ApiError, createLoadingToast } from "@/app/lib/api-client"

interface SetupData {
  secret: string
  qrCode: string
}

interface TwoFactorIdleProps {
  hasPassword: boolean
  onSetupStarted: (data: SetupData) => void
}

export function TwoFactorIdle({ hasPassword, onSetupStarted }: TwoFactorIdleProps) {
  const [isLoading, setIsLoading] = useState(false)

  const handleStartSetup = useCallback(async () => {
    if (!hasPassword) {
      toast.error("Two-factor authentication requires a password. Please set up a password first.")
      return
    }

    setIsLoading(true)
    const loader = createLoadingToast("Setting up 2FA...")

    try {
      const response = await api.post<SetupData>(
        "/api/auth/2fa/setup",
        {},
        { showErrorToast: false }
      )

      loader.dismiss()
      onSetupStarted(response)
    } catch (error) {
      const message = error instanceof ApiError ? error.message : "Failed to start 2FA setup"
      loader.error(message)
    } finally {
      setIsLoading(false)
    }
  }, [hasPassword, onSetupStarted])

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-4 rounded-lg border border-gray-200 bg-gray-50 p-4">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-gray-200">
          <HiShieldExclamation className="size-6 text-gray-500" />
        </div>
        <div className="flex-1">
          <h3 className="font-medium text-gray-900">Two-Factor Authentication is Off</h3>
          <p className="mt-1 text-sm text-gray-600">
            Add an extra layer of security to your account by enabling two-factor authentication.
            You will need an authenticator app like Google Authenticator or Authy.
          </p>
          {!hasPassword && (
            <p className="mt-2 text-sm text-amber-600">
              Note: You need to set up a password before enabling 2FA. OAuth-only accounts cannot
              use 2FA.
            </p>
          )}
          <button
            onClick={handleStartSetup}
            disabled={isLoading || !hasPassword}
            className="mt-4 inline-flex items-center gap-2 rounded-md bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <HiShieldCheck className="size-4" />
            Enable Two-Factor Authentication
          </button>
        </div>
      </div>
    </div>
  )
}
