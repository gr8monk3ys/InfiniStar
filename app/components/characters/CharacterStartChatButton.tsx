"use client"

import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import toast from "react-hot-toast"

import { Button } from "@/app/components/ui/button"
import { useCsrfToken } from "@/app/hooks/useCsrfToken"

export function CharacterStartChatButton({ characterId }: { characterId: string }) {
  const router = useRouter()
  const { data: session } = useSession()
  const { token } = useCsrfToken()

  const handleStart = async () => {
    if (!session?.user?.id) {
      router.push("/login")
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
