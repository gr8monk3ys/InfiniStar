"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@clerk/nextjs"
import toast from "react-hot-toast"

import { Button } from "@/app/components/ui/button"
import { useCsrfToken } from "@/app/hooks/useCsrfToken"

export function CharacterRemixButton({ characterId }: { characterId: string }) {
  const router = useRouter()
  const { isSignedIn } = useAuth()
  const { token } = useCsrfToken()
  const [isLoading, setIsLoading] = useState(false)

  const handleRemix = async () => {
    if (!isSignedIn) {
      router.push("/sign-in")
      return
    }

    if (isLoading) return
    setIsLoading(true)

    try {
      const response = await fetch(`/api/characters/${characterId}/remix`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": token || "",
        },
        body: JSON.stringify({}),
      })

      const data = (await response.json().catch(() => null)) as {
        id: string
        slug: string
        error?: string
      } | null

      if (!response.ok) {
        throw new Error(data?.error || "Failed to remix character")
      }

      toast.success("Character remixed")
      router.push(`/dashboard/characters/${data?.id}/edit`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to remix character")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Button type="button" variant="outline" onClick={handleRemix} disabled={isLoading}>
      {isLoading ? "Remixing..." : "Remix"}
    </Button>
  )
}
