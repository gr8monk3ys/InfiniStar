import { Suspense } from "react"

import LoginClient from "./LoginClient"

export default function LoginPage() {
  return (
    <Suspense
      fallback={<div className="min-h-full bg-gray-100" aria-busy="true" aria-live="polite" />}
    >
      <LoginClient />
    </Suspense>
  )
}
