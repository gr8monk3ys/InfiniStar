"use client"

import { memo } from "react"
import { HiXMark } from "react-icons/hi2"

import { cn } from "@/app/lib/utils"
import { TAG_COLORS, type TagColor } from "@/app/types"

interface TagBadgeProps {
  tag: { id: string; name: string; color: string | null }
  /** Whether to show a remove button */
  removable?: boolean
  /** Callback when remove button is clicked */
  onRemove?: () => void
  /** Size variant */
  size?: "sm" | "md"
  /** Additional className */
  className?: string
  /** Whether to truncate long names */
  truncate?: boolean
}

/**
 * TagBadge - A small colored badge showing a tag name
 *
 * Displays a tag with its assigned color as a pill/badge.
 * Optionally includes a remove button for editing contexts.
 */
const TagBadge: React.FC<TagBadgeProps> = ({
  tag,
  removable = false,
  onRemove,
  size = "sm",
  className,
  truncate = true,
}) => {
  const colorScheme = TAG_COLORS[tag.color as TagColor] || TAG_COLORS.gray

  const sizeClasses = {
    sm: "px-1.5 py-0.5 text-[10px]",
    md: "px-2 py-0.5 text-xs",
  }

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    onRemove?.()
  }

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full font-medium transition-colors",
        colorScheme.bg,
        colorScheme.text,
        colorScheme.border,
        "border",
        sizeClasses[size],
        className
      )}
      title={tag.name}
    >
      <span className={cn(truncate && "max-w-[60px] truncate")}>{tag.name}</span>
      {removable && onRemove && (
        <button
          type="button"
          onClick={handleRemove}
          className={cn(
            "ml-0.5 rounded-full p-0.5 hover:bg-black/10 focus:outline-none focus:ring-1 focus:ring-offset-1",
            "focus:ring-current"
          )}
          aria-label={`Remove tag ${tag.name}`}
        >
          <HiXMark className="size-3" />
        </button>
      )}
    </span>
  )
}

export default memo(TagBadge)
