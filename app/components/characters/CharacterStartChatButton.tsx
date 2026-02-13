"use client"

import { useRouter } from "next/navigation"
import { useAuth } from "@clerk/nextjs"
import toast from "react-hot-toast"

import { Button } from "@/app/components/ui/button"
import { useCsrfToken } from "@/app/hooks/useCsrfToken"

export function CharacterStartChatButton({ characterId }: { characterId: string }) {
  const router = useRouter()
  const { userId, isSignedIn } = useAuth()
  const { token } = useCsrfToken()

  const handleStart = async () => {
    if (!isSignedIn || !userId) {
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
