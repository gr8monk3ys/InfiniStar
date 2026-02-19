"use client"

interface PasswordTabContentProps {
  currentPassword: string
  setCurrentPassword: (value: string) => void
  newPassword: string
  setNewPassword: (value: string) => void
  confirmPassword: string
  setConfirmPassword: (value: string) => void
  isLoading: boolean
  onSubmit: (e: React.FormEvent) => void
}

export function PasswordTabContent({
  currentPassword,
  setCurrentPassword,
  newPassword,
  setNewPassword,
  confirmPassword,
  setConfirmPassword,
  isLoading,
  onSubmit,
}: PasswordTabContentProps) {
  return (
    <form onSubmit={onSubmit} className="space-y-6" aria-label="Change password form">
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
