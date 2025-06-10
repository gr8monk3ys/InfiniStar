"use client"

import { useState } from "react"
import toast from "react-hot-toast"

import { api, ApiError, createLoadingToast } from "@/app/lib/api-client"

export function PasswordTabContent() {
  const [isLoading, setIsLoading] = useState(false)
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (newPassword !== confirmPassword) {
      toast.error("New passwords do not match")
      return
    }

    if (newPassword.length < 8) {
      toast.error("Password must be at least 8 characters")
      return
    }

    setIsLoading(true)
    const loader = createLoadingToast("Changing password...")

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
      const message = error instanceof ApiError ? error.message : "Failed to change password"
      loader.error(message)
    } finally {
      setIsLoading(false)
    }
  }

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
          type="password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          required
          disabled={isLoading}
          className="mt-1 block w-full rounded-md border border-border bg-background px-3 py-2 text-foreground shadow-sm focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:bg-muted"
          placeholder="Enter current password"
          aria-required="true"
        />
      </div>

      {/* New Password */}
      <div>
        <label htmlFor="newPassword" className="block text-sm font-medium text-foreground">
          New Password
        </label>
        <input
          id="newPassword"
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          required
          disabled={isLoading}
          className="mt-1 block w-full rounded-md border border-border bg-background px-3 py-2 text-foreground shadow-sm focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:bg-muted"
          placeholder="Enter new password"
          minLength={8}
          aria-required="true"
          aria-describedby="password-hint"
        />
        <p id="password-hint" className="mt-1 text-sm text-muted-foreground">
          Must be at least 8 characters
        </p>
      </div>

      {/* Confirm Password */}
      <div>
        <label htmlFor="confirmPassword" className="block text-sm font-medium text-foreground">
          Confirm New Password
        </label>
        <input
          id="confirmPassword"
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
          disabled={isLoading}
          className="mt-1 block w-full rounded-md border border-border bg-background px-3 py-2 text-foreground shadow-sm focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:bg-muted"
          placeholder="Confirm new password"
          minLength={8}
          aria-required="true"
        />
      </div>

      {/* Submit Button */}
      <div className="flex justify-end">
        <button
          type="submit"
          disabled={isLoading}
          aria-busy={isLoading}
          className="rounded-md bg-primary px-4 py-2 text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isLoading ? "Changing..." : "Change Password"}
        </button>
      </div>
    </form>
  )
}
