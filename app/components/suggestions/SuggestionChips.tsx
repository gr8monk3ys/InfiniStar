"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { HiArrowPath, HiChevronLeft, HiChevronRight, HiXMark } from "react-icons/hi2"

import { cn } from "@/app/lib/utils"
import { type Suggestion } from "@/app/hooks/useSuggestions"

/**
 * Props for SuggestionChips component
 */
interface SuggestionChipsProps {
  /** Array of suggestions to display */
  suggestions: Suggestion[]
  /** Callback when a suggestion is selected */
  onSelect: (text: string) => void
  /** Whether suggestions are loading */
  isLoading?: boolean
  /** Callback to refresh suggestions */
  onRefresh?: () => void
  /** Callback to dismiss/hide suggestions */
  onDismiss?: () => void
  /** Whether the chips bar is disabled */
  disabled?: boolean
  /** Additional CSS classes */
  className?: string
  /** Maximum number of visible chips before scrolling */
  maxVisible?: number
}

/**
 * A horizontal scrollable chip bar for displaying suggestions.
 * Supports keyboard navigation with Tab to cycle through chips.
 */
export function SuggestionChips({
  suggestions,
  onSelect,
  isLoading = false,
  onRefresh,
  onDismiss,
  disabled = false,
  className,
  maxVisible: _maxVisible = 4,
}: SuggestionChipsProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)
  const [focusedIndex, setFocusedIndex] = useState(-1)
  const chipRefs = useRef<(HTMLButtonElement | null)[]>([])

  // Check scroll state
  const updateScrollState = useCallback(() => {
    const container = scrollContainerRef.current
    if (!container) return

    setCanScrollLeft(container.scrollLeft > 0)
    setCanScrollRight(container.scrollLeft < container.scrollWidth - container.clientWidth - 1)
  }, [])

  // Update scroll state on suggestions change or resize
  useEffect(() => {
    updateScrollState()

    const container = scrollContainerRef.current
    if (container) {
      container.addEventListener("scroll", updateScrollState)
      window.addEventListener("resize", updateScrollState)

      return () => {
        container.removeEventListener("scroll", updateScrollState)
        window.removeEventListener("resize", updateScrollState)
      }
    }
  }, [suggestions, updateScrollState])

  // Scroll functions
  const scrollLeft = useCallback(() => {
    const container = scrollContainerRef.current
    if (container) {
      container.scrollBy({ left: -200, behavior: "smooth" })
    }
  }, [])

  const scrollRight = useCallback(() => {
    const container = scrollContainerRef.current
    if (container) {
      container.scrollBy({ left: 200, behavior: "smooth" })
    }
  }, [])

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent, index: number) => {
      switch (e.key) {
        case "ArrowLeft":
          e.preventDefault()
          if (index > 0) {
            setFocusedIndex(index - 1)
            chipRefs.current[index - 1]?.focus()
          }
          break
        case "ArrowRight":
          e.preventDefault()
          if (index < suggestions.length - 1) {
            setFocusedIndex(index + 1)
            chipRefs.current[index + 1]?.focus()
          }
          break
        case "Enter":
        case " ":
          e.preventDefault()
          if (!disabled) {
            onSelect(suggestions[index].text)
          }
          break
        case "Escape":
          e.preventDefault()
          onDismiss?.()
          break
      }
    },
    [suggestions, disabled, onSelect, onDismiss]
  )

  // Handle chip click
  const handleChipClick = useCallback(
    (text: string) => {
      if (!disabled) {
        onSelect(text)
      }
    },
    [disabled, onSelect]
  )

  if (suggestions.length === 0 && !isLoading) {
    return null
  }

  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-lg border border-border bg-background/80 px-2 py-1.5 backdrop-blur-sm",
        className
      )}
      role="group"
      aria-label="Message suggestions"
    >
      {/* Scroll left button */}
      {canScrollLeft && (
        <button
          type="button"
          onClick={scrollLeft}
          className="shrink-0 rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground"
          aria-label="Scroll suggestions left"
        >
          <HiChevronLeft className="size-4" aria-hidden="true" />
        </button>
      )}

      {/* Suggestions container */}
      <div
        ref={scrollContainerRef}
        className="scrollbar-hide flex flex-1 gap-2 overflow-x-auto"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        {isLoading ? (
          // Loading skeleton
          <>
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-7 w-32 shrink-0 animate-pulse rounded-full bg-muted"
                aria-hidden="true"
              />
            ))}
          </>
        ) : (
          // Suggestion chips
          suggestions.map((suggestion, index) => (
            <button
              key={suggestion.id}
              ref={(el) => {
                chipRefs.current[index] = el
              }}
              type="button"
              onClick={() => handleChipClick(suggestion.text)}
              onKeyDown={(e) => handleKeyDown(e, index)}
              onFocus={() => setFocusedIndex(index)}
              disabled={disabled}
              aria-label={`Suggestion: ${suggestion.text}`}
              className={cn(
                "shrink-0 rounded-full border px-3 py-1 text-xs font-medium transition-all",
                "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1",
                "border-border bg-secondary text-secondary-foreground",
                "hover:bg-accent hover:text-accent-foreground",
                disabled && "cursor-not-allowed opacity-50",
                focusedIndex === index && "ring-2 ring-ring"
              )}
            >
              <span className="line-clamp-1 max-w-[200px]">{suggestion.text}</span>
            </button>
          ))
        )}
      </div>

      {/* Scroll right button */}
      {canScrollRight && (
        <button
          type="button"
          onClick={scrollRight}
          className="shrink-0 rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground"
          aria-label="Scroll suggestions right"
        >
          <HiChevronRight className="size-4" aria-hidden="true" />
        </button>
      )}

      {/* Refresh button */}
      {onRefresh && !isLoading && (
        <button
          type="button"
          onClick={onRefresh}
          disabled={disabled}
          className={cn(
            "shrink-0 rounded p-1 text-muted-foreground transition-colors",
            "hover:bg-accent hover:text-foreground",
            "focus:outline-none focus:ring-2 focus:ring-ring",
            disabled && "cursor-not-allowed opacity-50"
          )}
          aria-label="Refresh suggestions"
        >
          <HiArrowPath className="size-3.5" aria-hidden="true" />
        </button>
      )}

      {/* Dismiss button */}
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className={cn(
            "shrink-0 rounded p-1 text-muted-foreground transition-colors",
            "hover:bg-accent hover:text-foreground",
            "focus:outline-none focus:ring-2 focus:ring-ring"
          )}
          aria-label="Dismiss suggestions"
        >
          <HiXMark className="size-3.5" aria-hidden="true" />
        </button>
      )}
    </div>
  )
}

export default SuggestionChips
