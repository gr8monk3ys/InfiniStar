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
        <h1 className="mb-2 text-2xl font-semibold text-foreground">Something went wrong</h1>
        <p className="mb-6 text-sm text-muted-foreground">
          We could not complete your request. Please try again.
        </p>
        {process.env.NODE_ENV === "development" && (
          <p className="mb-4 rounded-lg bg-red-50 p-3 text-xs text-red-600">{error.message}</p>
        )}
        <div className="flex flex-col gap-3">
          <button
            onClick={reset}
            className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700"
          >
            Try again
          </button>
          <Link href="/login" className="text-sm text-muted-foreground hover:text-foreground">
            Back to login
          </Link>
        </div>
      </div>
    </div>
  )
}
