"use client"

import { useTransition } from "react"
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
  const [isStarting, startTransition] = useTransition()

  const handleStart = () => {
    const isAuthenticated = Boolean(isSignedIn && userId)

    posthog.capture("character_start_chat_clicked", {
      characterId,
      slug,
      isAuthenticated,
    })

    if (!isAuthenticated) {
      // Quantify the dead-end BEFORE we bounce the visitor to sign-in.
      posthog.capture("start_chat_signup_wall_hit", { characterId, slug })
      // Send them back to this character after auth; the sign-in page and Clerk both honor redirect_url.
      router.push(`/sign-in?redirect_url=${encodeURIComponent(`/characters/${slug}`)}`)
      return
    }

    // The transition stays pending until the conversation page takes over, so
    // the button shows progress and cannot fire a second request meanwhile.
    startTransition(async () => {
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

        const data = (await response.json().catch(() => ({}))) as { id?: string; error?: string }

        if (!response.ok || !data.id) {
          throw new Error(data.error || "Couldn't start the chat. Try again.")
        }

        router.push(`/dashboard/conversations/${data.id}`)
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Couldn't start the chat. Try again.")
      }
    })
  }

  return (
    <Button type="button" onClick={handleStart} disabled={isStarting} aria-busy={isStarting}>
      {isStarting ? "Starting…" : "Start Chat"}
    </Button>
  )
}
