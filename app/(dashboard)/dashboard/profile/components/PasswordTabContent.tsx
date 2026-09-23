"use client"

import { useRef, useState } from "react"

import { api, ApiError, createLoadingToast } from "@/app/lib/api-client"

type PasswordFieldError = { field: "newPassword" | "confirmPassword"; message: string } | null

const INPUT_CLASS =
  "mt-1 block w-full rounded-md border border-border bg-background px-3 py-2 text-foreground shadow-sm focus-visible:border-ring focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:bg-muted aria-[invalid=true]:border-destructive"

export function PasswordTabContent() {
  const [isLoading, setIsLoading] = useState(false)
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [fieldError, setFieldError] = useState<PasswordFieldError>(null)
  const newPasswordRef = useRef<HTMLInputElement>(null)
  const confirmPasswordRef = useRef<HTMLInputElement>(null)

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (newPassword.length < 8) {
      setFieldError({
        field: "newPassword",
        message: "Use at least 8 characters for your new password.",
      })
      newPasswordRef.current?.focus()
      return
    }

    if (newPassword !== confirmPassword) {
      setFieldError({
        field: "confirmPassword",
        message: "Passwords don't match. Re-enter your new password.",
      })
      confirmPasswordRef.current?.focus()
      return
    }

    setFieldError(null)
    setIsLoading(true)
    const loader = createLoadingToast("Changing password…")

    try {
      const response = await api.patch<{ message: string }>(
        "/api/profile",
        { currentPassword, newPassword },
        { retries: 1, showErrorToast: false }
      )

      loader.success(response.message)
      setCurrentPassword("")
      setNewPassword("")
      setConfirmPassword("")
    } catch (error) {
      const message =
        error instanceof ApiError
          ? error.message
          : "Couldn't change your password. Check your connection and try again."
      loader.error(message)
    } finally {
      setIsLoading(false)
    }
  }

  const newPasswordInvalid = fieldError?.field === "newPassword"
  const confirmPasswordInvalid = fieldError?.field === "confirmPassword"

  return (
    <form onSubmit={handlePasswordSubmit} className="space-y-6" aria-label="Change password form">
      <p className="text-sm text-muted-foreground">
        Choose a strong password to keep your account secure.
      </p>

      {/* Current Password */}
      <div>
        <label htmlFor="currentPassword" className="block text-sm font-medium text-foreground">
          Current Password
        </label>
        <input
          id="currentPassword"
          name="currentPassword"
          type="password"
          autoComplete="current-password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          required
          disabled={isLoading}
          className={INPUT_CLASS}
          placeholder="Enter current password…"
          aria-required="true"
        />
      </div>

      {/* New Password */}
      <div>
        <label htmlFor="newPassword" className="block text-sm font-medium text-foreground">
          New Password
        </label>
        <input
          ref={newPasswordRef}
          id="newPassword"
          name="newPassword"
          type="password"
          autoComplete="new-password"
          value={newPassword}
          onChange={(e) => {
            setNewPassword(e.target.value)
            if (newPasswordInvalid) setFieldError(null)
          }}
          required
          disabled={isLoading}
          className={INPUT_CLASS}
          placeholder="Enter new password…"
          minLength={8}
          aria-required="true"
          aria-invalid={newPasswordInvalid || undefined}
          aria-describedby={
            newPasswordInvalid ? "password-hint new-password-error" : "password-hint"
          }
        />
        <p id="password-hint" className="mt-1 text-sm text-muted-foreground">
          Must be at least 8 characters
        </p>
        {newPasswordInvalid ? (
          <p id="new-password-error" className="mt-1 text-sm text-destructive" aria-live="polite">
            {fieldError.message}
          </p>
        ) : null}
      </div>

      {/* Confirm Password */}
      <div>
        <label htmlFor="confirmPassword" className="block text-sm font-medium text-foreground">
          Confirm New Password
        </label>
        <input
          ref={confirmPasswordRef}
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(e) => {
            setConfirmPassword(e.target.value)
            if (confirmPasswordInvalid) setFieldError(null)
          }}
          required
          disabled={isLoading}
          className={INPUT_CLASS}
          placeholder="Re-enter new password…"
          minLength={8}
          aria-required="true"
          aria-invalid={confirmPasswordInvalid || undefined}
          aria-describedby={confirmPasswordInvalid ? "confirm-password-error" : undefined}
        />
        {confirmPasswordInvalid ? (
          <p
            id="confirm-password-error"
            className="mt-1 text-sm text-destructive"
            aria-live="polite"
          >
            {fieldError.message}
          </p>
        ) : null}
      </div>

      {/* Submit Button */}
      <div className="flex justify-end">
        <button
          type="submit"
          disabled={isLoading}
          aria-busy={isLoading}
          className="rounded-md bg-primary px-4 py-2 text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isLoading ? "Changing…" : "Change Password"}
        </button>
      </div>
    </form>
  )
}
