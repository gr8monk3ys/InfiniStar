"use client"

import React, { Component, type ErrorInfo, type ReactNode } from "react"

import { Button } from "./ui/button"

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error?: Error
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Error caught by boundary:", error, errorInfo)

    // Log to error tracking service (e.g., Sentry)
    if (typeof window !== "undefined" && process.env.NODE_ENV === "production") {
      // @ts-ignore - Sentry example
      if (window.Sentry) {
        // @ts-ignore
        window.Sentry.captureException(error, { extra: errorInfo })
      }
    }
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4">
          <div className="w-full max-w-md rounded-lg bg-white p-8 shadow-lg">
            <div className="mb-4 flex justify-center">
              <svg
                className="size-16 text-red-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>

            <h1 className="mb-2 text-center text-2xl font-bold text-gray-900">
              Something went wrong
            </h1>

            <p className="mb-6 text-center text-gray-600">
              We&apos;re sorry for the inconvenience. Please try refreshing the page or contact
              support if the problem persists.
            </p>

            {process.env.NODE_ENV === "development" && this.state.error && (
              <div className="mb-4 rounded-md bg-red-50 p-4">
                <p className="mb-2 text-sm font-medium text-red-800">Error Details:</p>
                <pre className="overflow-auto text-xs text-red-700">{this.state.error.message}</pre>
                {this.state.error.stack && (
                  <pre className="mt-2 overflow-auto text-xs text-red-600">
                    {this.state.error.stack.split("\n").slice(0, 5).join("\n")}
                  </pre>
                )}
              </div>
            )}

            <div className="flex flex-col gap-2">
              <Button
                onClick={() => {
                  this.setState({ hasError: false, error: undefined })
                  window.location.reload()
                }}
                className="w-full"
              >
                Refresh Page
              </Button>

              <Button
                variant="outline"
                onClick={() => {
                  this.setState({ hasError: false, error: undefined })
                  window.location.href = "/"
                }}
                className="w-full"
              >
                Go to Homepage
              </Button>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

export default ErrorBoundary
