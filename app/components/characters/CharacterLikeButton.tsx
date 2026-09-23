"use client"

import { useEffect, useState } from "react"
import toast from "react-hot-toast"
import { HiHeart, HiOutlineHeart } from "react-icons/hi2"

import { useAppAuth } from "@/app/hooks/useAppAuth"
import { useCsrfToken } from "@/app/hooks/useCsrfToken"

interface CharacterLikeButtonProps {
  characterId: string
  /**
   * Known liked state, when the caller has it. The cached character page does
   * not — its HTML is shared by every visitor — so it leaves this out and the
   * button asks `/api/characters/[id]/like` once the session says who is
   * looking.
   */
  initialLiked?: boolean
  initialCount: number
}

export function CharacterLikeButton({
  characterId,
  initialLiked = false,
  initialCount,
}: CharacterLikeButtonProps) {
  const { isSignedIn } = useAppAuth()
  const [liked, setLiked] = useState(initialLiked)
  const [count, setCount] = useState(initialCount)
  const [isLoading, setIsLoading] = useState(false)
  const { token } = useCsrfToken()

  useEffect(() => {
    if (!isSignedIn) return

    const controller = new AbortController()
    fetch(`/api/characters/${characterId}/like`, {
      cache: "no-store",
      credentials: "include",
      signal: controller.signal,
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { liked?: boolean; likeCount?: number } | null) => {
        if (!data) return
        if (typeof data.liked === "boolean") setLiked(data.liked)
        if (typeof data.likeCount === "number") setCount(data.likeCount)
      })
      .catch(() => {
        // Unknown liked state reads as "not liked", same as signed out.
      })

    return () => controller.abort()
  }, [characterId, isSignedIn])

  const handleToggle = async (): Promise<void> => {
    if (isLoading) return

    setIsLoading(true)

    // Optimistic update
    const prevLiked = liked
    const prevCount = count
    setLiked((current) => !current)
    setCount((current) => (prevLiked ? current - 1 : current + 1))

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
        const data = (await res.json().catch(() => null)) as { error?: string } | null
        throw new Error(data?.error || "Couldn't update your like. Try again.")
      }
    } catch (error) {
      // Revert optimistic update on error
      setLiked(prevLiked)
      setCount(prevCount)
      toast.error(error instanceof Error ? error.message : "Couldn't update your like. Try again.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <button
      type="button"
      onClick={handleToggle}
      disabled={isLoading}
      className="flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-colors hover:bg-accent disabled:opacity-50"
      aria-label={liked ? "Unlike character" : "Like character"}
      aria-pressed={liked}
    >
      {liked ? (
        <HiHeart className="size-5 text-red-500" aria-hidden="true" />
      ) : (
        <HiOutlineHeart className="size-5" aria-hidden="true" />
      )}
      <span className="tabular-nums">{count}</span>
    </button>
  )
}
