"use client"

import { memo, useEffect, useState } from "react"
import { HiOutlineSparkles } from "react-icons/hi2"

import { api } from "@/app/lib/api-client"
import { cn } from "@/app/lib/utils"

interface MemoryBadgeProps {
  /** Additional className for the badge */
  className?: string
  /** Show count or just indicator */
  showCount?: boolean
  /** Size variant */
  size?: "sm" | "md"
}

interface MemoryCountResponse {
  memories: Array<{ id: string }>
  capacity: {
    current: number
    limit: number
  }
}

/**
 * MemoryBadge - Displays AI memory count indicator
 *
 * Shows a badge indicating how many memories the AI has stored for the user.
 * Can be displayed in conversation headers or settings.
 */
const MemoryBadge: React.FC<MemoryBadgeProps> = ({ className, showCount = true, size = "sm" }) => {
  const [count, setCount] = useState<number | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function fetchCount() {
      try {
        const response = await api.get<MemoryCountResponse>("/api/ai/memory", {
          showErrorToast: false,
        })
        setCount(response.capacity?.current || 0)
      } catch {
        // Silently fail - badge will just not show
        setCount(null)
      } finally {
        setIsLoading(false)
      }
    }

    fetchCount()
  }, [])

  // Don't render if loading or no memories
  if (isLoading || count === null || count === 0) {
    return null
  }

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1 rounded-full bg-purple-100 dark:bg-purple-900/30",
        size === "sm" ? "px-2 py-0.5 text-xs" : "px-3 py-1 text-sm",
        "text-purple-700 dark:text-purple-300",
        className
      )}
      title={`${count} memories stored`}
      aria-label={`AI has ${count} memories about you`}
    >
      <HiOutlineSparkles className={cn(size === "sm" ? "size-3" : "size-4")} />
      {showCount && <span>{count}</span>}
    </div>
  )
}

export default memo(MemoryBadge)
