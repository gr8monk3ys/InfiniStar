"use client"

import { useCallback } from "react"
import {
  HiArrowPath,
  HiChatBubbleBottomCenterText,
  HiQuestionMarkCircle,
  HiSparkles,
} from "react-icons/hi2"

import { cn } from "@/app/lib/utils"
import { type Suggestion, type SuggestionType } from "@/app/hooks/useSuggestions"

/**
 * Props for SuggestionCard component
 */
interface SuggestionCardProps {
  /** The suggestion to display */
  suggestion: Suggestion
  /** Callback when suggestion is clicked */
  onSelect: (text: string) => void
  /** Whether the card is in a compact mode */
  compact?: boolean
  /** Whether the card is disabled */
  disabled?: boolean
  /** Additional CSS classes */
  className?: string
}

/**
 * Get icon for suggestion type
 */
function getTypeIcon(type: SuggestionType) {
  switch (type) {
    case "reply":
      return <HiChatBubbleBottomCenterText className="size-3.5" aria-hidden="true" />
    case "question":
      return <HiQuestionMarkCircle className="size-3.5" aria-hidden="true" />
    case "continue":
      return <HiSparkles className="size-3.5" aria-hidden="true" />
    case "rephrase":
      return <HiArrowPath className="size-3.5" aria-hidden="true" />
    default:
      return null
  }
}

/**
 * Get color classes for suggestion type
 */
function getTypeColors(type: SuggestionType): {
  bg: string
  border: string
  hover: string
  icon: string
} {
  switch (type) {
    case "reply":
      return {
        bg: "bg-blue-50 dark:bg-blue-950/30",
        border: "border-blue-200 dark:border-blue-800",
        hover: "hover:bg-blue-100 dark:hover:bg-blue-900/40",
        icon: "text-blue-600 dark:text-blue-400",
      }
    case "question":
      return {
        bg: "bg-purple-50 dark:bg-purple-950/30",
        border: "border-purple-200 dark:border-purple-800",
        hover: "hover:bg-purple-100 dark:hover:bg-purple-900/40",
        icon: "text-purple-600 dark:text-purple-400",
      }
    case "continue":
      return {
        bg: "bg-amber-50 dark:bg-amber-950/30",
        border: "border-amber-200 dark:border-amber-800",
        hover: "hover:bg-amber-100 dark:hover:bg-amber-900/40",
        icon: "text-amber-600 dark:text-amber-400",
      }
    case "rephrase":
      return {
        bg: "bg-green-50 dark:bg-green-950/30",
        border: "border-green-200 dark:border-green-800",
        hover: "hover:bg-green-100 dark:hover:bg-green-900/40",
        icon: "text-green-600 dark:text-green-400",
      }
    default:
      return {
        bg: "bg-gray-50 dark:bg-gray-950/30",
        border: "border-gray-200 dark:border-gray-800",
        hover: "hover:bg-gray-100 dark:hover:bg-gray-900/40",
        icon: "text-gray-600 dark:text-gray-400",
      }
  }
}

/**
 * A card component that displays an individual suggestion
 * with appropriate styling based on the suggestion type.
 */
export function SuggestionCard({
  suggestion,
  onSelect,
  compact = false,
  disabled = false,
  className,
}: SuggestionCardProps) {
  const colors = getTypeColors(suggestion.type)
  const icon = getTypeIcon(suggestion.type)

  const handleClick = useCallback(() => {
    if (!disabled) {
      onSelect(suggestion.text)
    }
  }, [disabled, onSelect, suggestion.text])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if ((e.key === "Enter" || e.key === " ") && !disabled) {
        e.preventDefault()
        onSelect(suggestion.text)
      }
    },
    [disabled, onSelect, suggestion.text]
  )

  return (
    <button
      type="button"
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      disabled={disabled}
      aria-label={`Use suggestion: ${suggestion.text}`}
      className={cn(
        "flex items-start gap-2 rounded-lg border text-left transition-all",
        "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
        colors.bg,
        colors.border,
        colors.hover,
        disabled && "cursor-not-allowed opacity-50",
        compact ? "px-2.5 py-1.5" : "px-3 py-2",
        className
      )}
    >
      <span className={cn("mt-0.5 shrink-0", colors.icon)}>{icon}</span>
      <span className={cn("text-foreground", compact ? "text-xs" : "text-sm", "line-clamp-2")}>
        {suggestion.text}
      </span>
    </button>
  )
}

export default SuggestionCard
