"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

import { api, createLoadingToast } from "@/app/lib/api-client"

export default function ResendVerificationPage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [emailSent, setEmailSent] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    const loader = createLoadingToast("Sending verification link...")

    try {
      const response = await api.post<{ message: string }>(
        "/api/auth/resend-verification",
        { email },
        {
          retries: 2,
          showErrorToast: false,
        }
      )

      setEmailSent(true)
      loader.success(response.message)
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to send verification email"
      loader.error(message)
    } finally {
      setIsLoading(false)
    }
  }

  if (emailSent) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-100 px-4">
        <div className="w-full max-w-md rounded-lg bg-white p-8 shadow-lg">
          <div className="text-center">
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
            <h1 className="text-2xl font-bold text-gray-900">Email Sent!</h1>
            <p className="mt-2 text-gray-600">
              If an account exists with that email, we&apos;ve sent a new verification link.
            </p>
            <p className="mt-4 text-sm text-gray-500">
              Please check your email and click the verification link to activate your account.
            </p>
            <div className="mt-6 space-y-3">
              <button
                onClick={() => router.push("/")}
                className="w-full rounded-md bg-purple-600 px-4 py-2 text-white transition hover:bg-purple-700"
              >
                Go to Login
              </button>
              <button
                onClick={() => setEmailSent(false)}
                className="w-full rounded-md border border-gray-300 bg-white px-4 py-2 text-gray-700 transition hover:bg-gray-50"
              >
                Send Another Link
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100 px-4">
      <div className="w-full max-w-md rounded-lg bg-white p-8 shadow-lg">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold text-gray-900">Resend Verification Email</h1>
          <p className="mt-2 text-gray-600">
            Enter your email address and we&apos;ll send you a new verification link
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700">
              Email Address
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={isLoading}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-purple-500 focus:outline-none focus:ring-purple-500 disabled:cursor-not-allowed disabled:bg-gray-100"
              placeholder="you@example.com"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full rounded-md bg-purple-600 px-4 py-2 text-white transition hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isLoading ? "Sending..." : "Send Verification Email"}
          </button>

          <div className="mt-4 text-center">
            <button
              type="button"
              onClick={() => router.push("/")}
              className="text-sm text-purple-600 hover:text-purple-700"
            >
              Back to Login
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
