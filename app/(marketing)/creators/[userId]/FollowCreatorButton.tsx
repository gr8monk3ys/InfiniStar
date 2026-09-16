"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import toast from "react-hot-toast"

import { Button } from "@/app/components/ui/button"
import { useAppAuth } from "@/app/hooks/useAppAuth"
import { useCsrfToken } from "@/app/hooks/useCsrfToken"

interface FollowCreatorButtonProps {
  creatorId: string
  creatorName: string
  /**
   * Known follow state, when the caller has it. The cached creator page does
   * not — its HTML is shared by every visitor — so it leaves this out and the
   * button asks `GET /api/creators/[id]/follow` once the session says who is
   * looking.
   */
  initialIsFollowing?: boolean
  initialFollowerCount: number
}

export default function FollowCreatorButton({
  creatorId,
  creatorName,
  initialIsFollowing = false,
  initialFollowerCount,
}: FollowCreatorButtonProps) {
  const { userId, isSignedInHint } = useAppAuth()
  const { token: csrfToken } = useCsrfToken()

  const [isFollowing, setIsFollowing] = useState(initialIsFollowing)
  const [followerCount, setFollowerCount] = useState(initialFollowerCount)
  const [isLoading, setIsLoading] = useState(false)

  // A creator cannot follow themselves; the page cannot know who is looking.
  const disabled = userId === creatorId

  useEffect(() => {
    if (!userId) return

    const controller = new AbortController()
    fetch(`/api/creators/${creatorId}/follow`, {
      cache: "no-store",
      credentials: "include",
      signal: controller.signal,
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { isFollowing?: boolean; followerCount?: number } | null) => {
        if (!data) return
        if (typeof data.isFollowing === "boolean") setIsFollowing(data.isFollowing)
        if (typeof data.followerCount === "number") setFollowerCount(data.followerCount)
      })
      .catch(() => {
        // Unknown follow state reads as "not following", same as signed out.
      })

    return () => controller.abort()
  }, [creatorId, userId])

  const handleToggleFollow = async () => {
    if (!csrfToken) {
      toast.error("Security token not available. Please refresh the page.")
      return
    }

    setIsLoading(true)
    try {
      const response = await fetch(`/api/creators/${creatorId}/follow`, {
        method: isFollowing ? "DELETE" : "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": csrfToken,
        },
      })

      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { error?: string } | null
        throw new Error(data?.error || "Request failed")
      }

      const data = (await response.json()) as { isFollowing: boolean; followerCount: number }
      setIsFollowing(data.isFollowing)
      setFollowerCount(data.followerCount)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update follow status")
    } finally {
      setIsLoading(false)
    }
  }

  // The hint picks the layout at hydration so a signed-in visitor does not see
  // "Sign in to follow" flash; the real user id gates the request below.
  if (!userId && !isSignedInHint) {
    return (
      <div className="flex items-center gap-3">
        <Button asChild size="sm" variant="outline">
          <Link href="/sign-in">Sign in to follow</Link>
        </Button>
        <p className="text-sm text-muted-foreground">
          {followerCount.toLocaleString()} follower{followerCount === 1 ? "" : "s"}
        </p>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-3">
      <Button
        type="button"
        size="sm"
        variant={isFollowing ? "secondary" : "default"}
        disabled={disabled || isLoading || !userId}
        onClick={() => {
          if (disabled || !userId) return
          handleToggleFollow().catch(() => {
            // handled in function
          })
        }}
      >
        {disabled ? "This is you" : isFollowing ? "Following" : `Follow ${creatorName}`}
      </Button>
      <p className="text-sm text-muted-foreground">
        {followerCount.toLocaleString()} follower{followerCount === 1 ? "" : "s"}
      </p>
    </div>
  )
}
