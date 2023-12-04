"use client"

import { useState } from "react"
import toast from "react-hot-toast"
import { HiHeart, HiOutlineHeart } from "react-icons/hi2"

import { useCsrfToken } from "@/app/hooks/useCsrfToken"

interface CharacterLikeButtonProps {
  characterId: string
  initialLiked: boolean
  initialCount: number
}

export function CharacterLikeButton({
  characterId,
  initialLiked,
  initialCount,
}: CharacterLikeButtonProps) {
  const [liked, setLiked] = useState(initialLiked)
  const [count, setCount] = useState(initialCount)
  const [isLoading, setIsLoading] = useState(false)
  const { token } = useCsrfToken()

  const handleToggle = async (): Promise<void> => {
    if (isLoading) return

    setIsLoading(true)

    // Optimistic update
    const prevLiked = liked
    const prevCount = count
    setLiked(!liked)
    setCount(liked ? count - 1 : count + 1)

    try {
      const method = prevLiked ? "DELETE" : "POST"
      const res = await fetch(`/api/characters/${characterId}/like`, {
        method,
        headers: {
          "X-CSRF-Token": token || "",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Failed")
      }
    } catch (error) {
      // Revert optimistic update on error
      setLiked(prevLiked)
      setCount(prevCount)
      toast.error(error instanceof Error ? error.message : "Failed to update like")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <button
      onClick={handleToggle}
      disabled={isLoading}
      className="flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-colors hover:bg-accent disabled:opacity-50"
      aria-label={liked ? "Unlike character" : "Like character"}
      aria-pressed={liked}
    >
      {liked ? <HiHeart className="size-5 text-red-500" /> : <HiOutlineHeart className="size-5" />}
      <span>{count}</span>
    </button>
  )
}
