import { Suspense } from "react"

import TwoFactorLoginClient from "./TwoFactorLoginClient"

export default function TwoFactorLoginPage() {
  return (
    <Suspense
      fallback={<div className="min-h-full bg-gray-100" aria-busy="true" aria-live="polite" />}
    >
      <TwoFactorLoginClient />
    </Suspense>
  )
}
