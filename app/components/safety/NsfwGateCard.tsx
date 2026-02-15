"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@clerk/nextjs"

import { api, ApiError, createLoadingToast } from "@/app/lib/api-client"
import { Button } from "@/app/components/ui/button"

export function NsfwGateCard() {
  const router = useRouter()
  const { isSignedIn } = useAuth()
  const [isLoading, setIsLoading] = useState(false)

  const handleEnable = async () => {
    if (!isSignedIn) {
      router.push("/sign-in")
      return
    }

    setIsLoading(true)
    const loader = createLoadingToast("Enabling NSFW content...")

    try {
      await api.patch(
        "/api/safety/preferences",
        { isAdult: true, nsfwEnabled: true },
        { retries: 0, showErrorToast: false }
      )
      loader.success("NSFW content enabled")
      router.refresh()
    } catch (error) {
      const message = error instanceof ApiError ? error.message : "Failed to enable NSFW content"
      loader.error(message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Button onClick={handleEnable} disabled={isLoading} aria-busy={isLoading}>
      Enable 18+ NSFW
    </Button>
  )
}
