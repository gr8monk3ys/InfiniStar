"use client"

import { Suspense, useCallback, useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import toast from "react-hot-toast"

import { api } from "@/app/lib/api-client"

function VerifyEmailContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams?.get("token")

  const [isVerifying, setIsVerifying] = useState(true)
  const [status, setStatus] = useState<"success" | "error" | null>(null)
  const [message, setMessage] = useState("")

  const verifyEmail = useCallback(async () => {
    try {
      const response = await api.post<{ message: string }>(
        "/api/auth/verify-email",
        { token },
        {
          retries: 2,
          showErrorToast: false,
        }
      )

      setStatus("success")
      setMessage(response.message)
      toast.success("Email verified successfully!")

      // Redirect to login after 3 seconds
      setTimeout(() => {
        router.push("/")
      }, 3000)
    } catch (error) {
      setStatus("error")
      const errorMessage = error instanceof Error ? error.message : "Failed to verify email"
      setMessage(errorMessage)
      toast.error(errorMessage)
    } finally {
      setIsVerifying(false)
    }
  }, [token, router])

  useEffect(() => {
    if (!token) {
      setIsVerifying(false)
      setStatus("error")
      setMessage("No verification token provided")
      return
    }

    verifyEmail()
  }, [token, verifyEmail])

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100 px-4">
      <div className="w-full max-w-md rounded-lg bg-white p-8 shadow-lg">
        <div className="text-center">
          {isVerifying && (
            <>
              <div className="mx-auto mb-4 size-12 animate-spin rounded-full border-y-2 border-purple-500" />
              <h1 className="text-2xl font-bold text-gray-900">Verifying Email...</h1>
              <p className="mt-2 text-gray-600">Please wait while we verify your email address</p>
            </>
          )}

          {status === "success" && (
            <>
              <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-green-100">
                <svg
                  className="size-6 text-green-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
              <h1 className="text-2xl font-bold text-gray-900">Email Verified!</h1>
              <p className="mt-2 text-gray-600">{message}</p>
              <p className="mt-4 text-sm text-gray-500">Redirecting to login...</p>
            </>
          )}

          {status === "error" && (
            <>
              <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-red-100">
                <svg
                  className="size-6 text-red-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </div>
              <h1 className="text-2xl font-bold text-gray-900">Verification Failed</h1>
              <p className="mt-2 text-gray-600">{message}</p>
              <div className="mt-6 space-y-3">
                <button
                  onClick={() => router.push("/")}
                  className="w-full rounded-md bg-purple-600 px-4 py-2 text-white transition hover:bg-purple-700"
                >
                  Go to Login
                </button>
                <button
                  onClick={() => router.push("/resend-verification")}
                  className="w-full rounded-md border border-gray-300 bg-white px-4 py-2 text-gray-700 transition hover:bg-gray-50"
                >
                  Request New Link
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function LoadingFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100">
      <div className="mx-auto size-12 animate-spin rounded-full border-y-2 border-purple-500" />
    </div>
  )
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <VerifyEmailContent />
    </Suspense>
  )
}
