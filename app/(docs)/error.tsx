"use client"

import { useEffect } from "react"
import * as Sentry from "@sentry/nextjs"

export default function DocsError({
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
          This page could not be loaded. Please try again.
        </p>
        {process.env.NODE_ENV === "development" && (
          <p className="mb-4 rounded-lg bg-red-50 p-3 text-xs text-red-600">{error.message}</p>
        )}
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={reset}
            className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700"
          >
            Try again
          </button>
          <button
            onClick={() => history.back()}
            className="rounded-lg border border-border px-4 py-2 text-sm font-semibold text-foreground hover:bg-accent"
          >
            Go back
          </button>
        </div>
      </div>
    </div>
  )
}
