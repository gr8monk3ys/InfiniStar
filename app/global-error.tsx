"use client"

import { useEffect } from "react"
import * as Sentry from "@sentry/nextjs"

export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => {
    Sentry.captureException(error)
  }, [error])

  return (
    <html lang="en">
      <body className="flex min-h-screen items-center justify-center bg-background text-foreground">
        <div className="max-w-md text-center">
          <h1 className="mb-2 text-2xl font-semibold">Something went wrong</h1>
          <p className="text-sm text-muted-foreground">Please refresh the page or try again.</p>
        </div>
      </body>
    </html>
  )
}
