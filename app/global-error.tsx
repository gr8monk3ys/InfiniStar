"use client"

import { useEffect } from "react"
import * as Sentry from "@sentry/nextjs"

export default function GlobalError({
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
    <html lang="en">
      <body className="flex min-h-screen items-center justify-center bg-background text-foreground">
        <div className="max-w-md text-center">
          <h1 className="mb-2 text-2xl font-semibold">Something Went Wrong</h1>
          <p className="text-sm text-muted-foreground">
            Try again, or refresh the page if the problem continues.
          </p>
          <button
            type="button"
            onClick={reset}
            className="mt-6 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
          >
            Try Again
          </button>
        </div>
      </body>
    </html>
  )
}
