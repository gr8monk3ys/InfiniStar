import { Suspense } from "react"

import VerifyEmailClient from "./VerifyEmailClient"

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
      <VerifyEmailClient />
    </Suspense>
  )
}
