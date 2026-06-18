"use client"

import { useRouter } from "next/navigation"
import posthog from "posthog-js"
import toast from "react-hot-toast"

import { Button } from "@/app/components/ui/button"
import { useAppAuth } from "@/app/hooks/useAppAuth"
import { useCsrfToken } from "@/app/hooks/useCsrfToken"

export function CharacterStartChatButton({
  characterId,
  slug,
}: {
  characterId: string
  slug: string
}) {
  const router = useRouter()
  const { userId, isSignedIn } = useAppAuth()
  const { token } = useCsrfToken()

  const handleStart = async () => {
    const isAuthenticated = Boolean(isSignedIn && userId)

    posthog.capture("character_start_chat_clicked", {
      characterId,
      slug,
      isAuthenticated,
    })

    if (!isAuthenticated) {
      // Quantify the dead-end BEFORE we bounce the visitor to sign-in.
      posthog.capture("start_chat_signup_wall_hit", { characterId, slug })
      router.push("/sign-in")
      return
    }

    try {
      const response = await fetch("/api/conversations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": token || "",
        },
        body: JSON.stringify({
          isAI: true,
          characterId,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to start chat")
      }

      router.push(`/dashboard/conversations/${data.id}`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to start chat")
    }
  }

  return <Button onClick={handleStart}>Start Chat</Button>
}
