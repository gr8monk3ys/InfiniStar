import { Suspense } from "react"

import ResetPasswordClient from "./ResetPasswordClient"

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={<div className="min-h-screen bg-gray-100" aria-busy="true" aria-live="polite" />}
    >
      <ResetPasswordClient />
    </Suspense>
  )
}
