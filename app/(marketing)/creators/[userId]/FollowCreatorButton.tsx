"use client"

import { useState } from "react"
import Link from "next/link"
import { useAuth } from "@clerk/nextjs"
import toast from "react-hot-toast"

import { Button } from "@/app/components/ui/button"
import { useCsrfToken } from "@/app/hooks/useCsrfToken"

interface FollowCreatorButtonProps {
  creatorId: string
  creatorName: string
  initialIsFollowing: boolean
  initialFollowerCount: number
  disabled?: boolean
}

export default function FollowCreatorButton({
  creatorId,
  creatorName,
  initialIsFollowing,
  initialFollowerCount,
  disabled = false,
}: FollowCreatorButtonProps) {
  const { userId } = useAuth()
  const { token: csrfToken } = useCsrfToken()

  const [isFollowing, setIsFollowing] = useState(initialIsFollowing)
  const [followerCount, setFollowerCount] = useState(initialFollowerCount)
  const [isLoading, setIsLoading] = useState(false)

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

  if (!userId) {
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
        disabled={disabled || isLoading}
        onClick={() => {
          if (disabled) return
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
