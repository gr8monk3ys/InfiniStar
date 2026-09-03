"use client"

import { useCallback, useState } from "react"
import { toast } from "react-hot-toast"
import { HiEye, HiEyeSlash, HiKey, HiShieldCheck, HiShieldExclamation } from "react-icons/hi2"

import { api, ApiError, createLoadingToast } from "@/app/lib/api-client"

interface TwoFactorEnabledProps {
  remainingBackupCodes: number | null
  onDisabled: () => void
  onBackupCodesRegenerated: (codes: string[]) => void
}

export function TwoFactorEnabled({
  remainingBackupCodes,
  onDisabled,
  onBackupCodesRegenerated,
}: TwoFactorEnabledProps) {
  const [isLoading, setIsLoading] = useState(false)

  // Disable 2FA form state
  const [showDisableForm, setShowDisableForm] = useState(false)
  const [disablePassword, setDisablePassword] = useState("")
  const [disableCode, setDisableCode] = useState("")
  const [showDisablePassword, setShowDisablePassword] = useState(false)

  // Regenerate backup codes form state
  const [showRegenerateForm, setShowRegenerateForm] = useState(false)
  const [regeneratePassword, setRegeneratePassword] = useState("")
  const [regenerateCode, setRegenerateCode] = useState("")
  const [showRegeneratePassword, setShowRegeneratePassword] = useState(false)

  const handleDisable2FA = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()

      if (!disablePassword || !disableCode) {
        toast.error("Please enter both your password and verification code")
        return
      }

      setIsLoading(true)
      const loader = createLoadingToast("Disabling 2FA...")

      try {
        await api.post(
          "/api/auth/2fa/disable",
          { password: disablePassword, code: disableCode },
          { showErrorToast: false }
        )

        setShowDisableForm(false)
        setDisablePassword("")
        setDisableCode("")
        loader.success("Two-factor authentication disabled")
        onDisabled()
      } catch (error) {
        const message = error instanceof ApiError ? error.message : "Failed to disable 2FA"
        loader.error(message)
      } finally {
        setIsLoading(false)
      }
    },
    [disablePassword, disableCode, onDisabled]
  )

  const handleRegenerateBackupCodes = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()

      if (!regeneratePassword || !regenerateCode) {
        toast.error("Please enter both your password and verification code")
        return
      }

      setIsLoading(true)
      const loader = createLoadingToast("Generating new backup codes...")

      try {
        const response = await api.post<{ backupCodes: string[] }>(
          "/api/auth/2fa/backup-codes",
          { password: regeneratePassword, code: regenerateCode },
          { showErrorToast: false }
        )

        setShowRegenerateForm(false)
        setRegeneratePassword("")
        setRegenerateCode("")
        loader.success("New backup codes generated!")
        onBackupCodesRegenerated(response.backupCodes)
      } catch (error) {
        const message =
          error instanceof ApiError ? error.message : "Failed to generate backup codes"
        loader.error(message)
      } finally {
        setIsLoading(false)
      }
    },
    [regeneratePassword, regenerateCode, onBackupCodesRegenerated]
  )

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-4 rounded-lg border border-green-200 bg-green-50 p-4">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-green-100">
          <HiShieldCheck className="size-6 text-green-600" />
        </div>
        <div className="flex-1">
          <h3 className="font-medium text-foreground">Two-Factor Authentication is On</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Your account is protected with two-factor authentication.
          </p>
          {remainingBackupCodes !== null && (
            <p className="mt-2 text-sm text-muted-foreground">
              <HiKey className="mr-1 inline size-4" />
              {remainingBackupCodes} backup code{remainingBackupCodes !== 1 ? "s" : ""} remaining
            </p>
          )}
        </div>
      </div>

      {/* Regenerate Backup Codes */}
      {!showRegenerateForm ? (
        <button
          onClick={() => setShowRegenerateForm(true)}
          className="inline-flex items-center gap-2 text-sm font-medium text-primary-accent hover:text-primary/80"
        >
          <HiKey className="size-4" />
          Generate new backup codes
        </button>
      ) : (
        <form onSubmit={handleRegenerateBackupCodes} className="space-y-4 rounded-lg border p-4">
          <h4 className="font-medium text-foreground">Generate New Backup Codes</h4>
          <p className="text-sm text-muted-foreground">
            This will invalidate all existing backup codes.
          </p>

          <div>
            <label
              htmlFor="regeneratePassword"
              className="block text-sm font-medium text-foreground"
            >
              Password
            </label>
            <div className="relative mt-1">
              <input
                id="regeneratePassword"
                type={showRegeneratePassword ? "text" : "password"}
                value={regeneratePassword}
                onChange={(e) => setRegeneratePassword(e.target.value)}
                disabled={isLoading}
                className="block w-full rounded-md border border-input bg-background py-2 pl-3 pr-10 text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:bg-muted"
              />
              <button
                type="button"
                onClick={() => setShowRegeneratePassword(!showRegeneratePassword)}
                className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground"
                aria-label={showRegeneratePassword ? "Hide password" : "Show password"}
              >
                {showRegeneratePassword ? (
                  <HiEyeSlash className="size-5" />
                ) : (
                  <HiEye className="size-5" />
                )}
              </button>
            </div>
          </div>

          <div>
            <label htmlFor="regenerateCode" className="block text-sm font-medium text-foreground">
              Authenticator Code
            </label>
            <input
              id="regenerateCode"
              type="text"
              inputMode="numeric"
              value={regenerateCode}
              onChange={(e) => setRegenerateCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="000000"
              disabled={isLoading}
              maxLength={6}
              className="mt-1 block w-full rounded-md border border-input bg-background py-2 text-center font-mono tracking-widest text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:bg-muted"
            />
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setShowRegenerateForm(false)
                setRegeneratePassword("")
                setRegenerateCode("")
              }}
              disabled={isLoading}
              className="rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-accent hover:text-accent-foreground"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading || !regeneratePassword || regenerateCode.length !== 6}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isLoading ? "Generating..." : "Generate Codes"}
            </button>
          </div>
        </form>
      )}

      {/* Disable 2FA */}
      {!showDisableForm ? (
        <button
          onClick={() => setShowDisableForm(true)}
          className="inline-flex items-center gap-2 text-sm font-medium text-destructive hover:text-destructive/80"
        >
          <HiShieldExclamation className="size-4" />
          Disable two-factor authentication
        </button>
      ) : (
        <form
          onSubmit={handleDisable2FA}
          className="space-y-4 rounded-lg border border-destructive/30 bg-destructive/10 p-4"
        >
          <h4 className="font-medium text-destructive">Disable Two-Factor Authentication</h4>
          <p className="text-sm text-destructive/90">
            This will make your account less secure. Enter your password and a verification code to
            confirm.
          </p>

          <div>
            <label htmlFor="disablePassword" className="block text-sm font-medium text-foreground">
              Password
            </label>
            <div className="relative mt-1">
              <input
                id="disablePassword"
                type={showDisablePassword ? "text" : "password"}
                value={disablePassword}
                onChange={(e) => setDisablePassword(e.target.value)}
                disabled={isLoading}
                className="block w-full rounded-md border border-input bg-background py-2 pl-3 pr-10 text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:bg-muted"
              />
              <button
                type="button"
                onClick={() => setShowDisablePassword(!showDisablePassword)}
                className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground"
                aria-label={showDisablePassword ? "Hide password" : "Show password"}
              >
                {showDisablePassword ? (
                  <HiEyeSlash className="size-5" />
                ) : (
                  <HiEye className="size-5" />
                )}
              </button>
            </div>
          </div>

          <div>
            <label htmlFor="disableCode" className="block text-sm font-medium text-foreground">
              Authenticator Code or Backup Code
            </label>
            <input
              id="disableCode"
              type="text"
              value={disableCode}
              onChange={(e) => setDisableCode(e.target.value.toUpperCase())}
              placeholder="000000 or XXXX-XXXX"
              disabled={isLoading}
              className="mt-1 block w-full rounded-md border border-input bg-background py-2 text-center font-mono tracking-widest text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:bg-muted"
            />
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setShowDisableForm(false)
                setDisablePassword("")
                setDisableCode("")
              }}
              disabled={isLoading}
              className="rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-accent hover:text-accent-foreground"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading || !disablePassword || !disableCode}
              className="rounded-md bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground hover:bg-destructive/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isLoading ? "Disabling..." : "Disable 2FA"}
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
