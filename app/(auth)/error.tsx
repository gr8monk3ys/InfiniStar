"use client"

import { useEffect } from "react"
import Link from "next/link"
import * as Sentry from "@sentry/nextjs"

export default function AuthError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    Sentry.captureException(error)
  }, [error])

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-sm text-center">
        <h1 className="mb-2 text-2xl font-semibold text-foreground">Something Went Wrong</h1>
        <p className="mb-6 text-sm text-muted-foreground">
          Your request didn&apos;t go through. Try again, or go back to sign in.
        </p>
        {process.env.NODE_ENV === "development" && (
          <p className="mb-4 break-words rounded-lg bg-destructive/10 p-3 text-xs text-destructive">
            {error.message}
          </p>
        )}
        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={reset}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
          >
            Try Again
          </button>
          <Link href="/sign-in" className="text-sm text-muted-foreground hover:text-foreground">
            Back to Sign In
          </Link>
        </div>
      </div>
    </div>
  )
}
