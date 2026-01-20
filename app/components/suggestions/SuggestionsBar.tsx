"use client"

import { useCallback, useState } from "react"
import { HiLightBulb } from "react-icons/hi2"

import { cn } from "@/app/lib/utils"
import {
  useSuggestionPreferences,
  useSuggestions,
  type SuggestionType,
} from "@/app/hooks/useSuggestions"
import { type FullMessageType } from "@/app/types"

import { SuggestionChips } from "./SuggestionChips"

/**
 * Props for SuggestionsBar component
 */
interface SuggestionsBarProps {
  /** Conversation ID for fetching suggestions */
  conversationId: string
  /** Messages for context */
  messages: FullMessageType[]
  /** Callback when a suggestion is selected */
  onSuggestionSelect: (text: string, mode: "replace" | "append") => void
  /** Whether the form is disabled (e.g., while sending) */
  disabled?: boolean
  /** Current input text (for rephrase/continue suggestions) */
  currentInput?: string
  /** Whether to hide when user is actively typing */
  hideWhileTyping?: boolean
  /** Additional CSS classes */
  className?: string
}

/**
 * A smart suggestions bar that displays contextual suggestions
 * above or below the message input.
 */
export function SuggestionsBar({
  conversationId,
  messages,
  onSuggestionSelect,
  disabled = false,
  currentInput = "",
  hideWhileTyping = true,
  className,
}: SuggestionsBarProps) {
  const { preferences } = useSuggestionPreferences()
  const [isDismissed, setIsDismissed] = useState(false)
  const [isMinimized, setIsMinimized] = useState(false)

  const {
    suggestions,
    isLoading,
    fetchSuggestions,
    clearSuggestions,
    refreshSuggestions,
    isEnabled,
  } = useSuggestions({
    conversationId,
    messages,
    enabled: preferences.enabled && !isDismissed,
    autoFetchOnAiResponse: preferences.autoShow,
  })

  // Handle suggestion selection
  const handleSelect = useCallback(
    (text: string) => {
      // Determine if we should replace or append based on current input
      const mode = currentInput.trim().length > 0 ? "append" : "replace"
      onSuggestionSelect(text, mode)
      clearSuggestions()
    },
    [currentInput, onSuggestionSelect, clearSuggestions]
  )

  // Handle dismiss
  const handleDismiss = useCallback(() => {
    setIsDismissed(true)
    clearSuggestions()
  }, [clearSuggestions])

  // Handle minimize/expand toggle
  const handleToggleMinimize = useCallback(() => {
    setIsMinimized((prev) => !prev)
  }, [])

  // Handle fetch for specific type (can be used for manual type selection)
  const _handleFetchType = useCallback(
    (type: SuggestionType) => {
      fetchSuggestions(type, type === "continue" || type === "rephrase" ? currentInput : undefined)
    },
    [fetchSuggestions, currentInput]
  )

  // Don't show if disabled, dismissed, or no suggestions and not loading
  if (
    !isEnabled ||
    isDismissed ||
    (suggestions.length === 0 && !isLoading) ||
    (hideWhileTyping && currentInput.length > 0)
  ) {
    return null
  }

  // Minimized state - just show toggle button
  if (isMinimized) {
    return (
      <div className={cn("flex justify-center px-4 py-1", className)}>
        <button
          type="button"
          onClick={handleToggleMinimize}
          className={cn(
            "flex items-center gap-1 rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground",
            "hover:bg-accent hover:text-foreground",
            "focus:outline-none focus:ring-2 focus:ring-ring"
          )}
          aria-label="Show suggestions"
        >
          <HiLightBulb className="size-3.5 text-amber-500" aria-hidden="true" />
          <span>
            {suggestions.length} suggestion{suggestions.length !== 1 ? "s" : ""}
          </span>
        </button>
      </div>
    )
  }

  return (
    <div className={cn("px-4 py-2", className)}>
      <SuggestionChips
        suggestions={suggestions}
        onSelect={handleSelect}
        isLoading={isLoading}
        onRefresh={refreshSuggestions}
        onDismiss={handleDismiss}
        disabled={disabled}
      />
    </div>
  )
}

export default SuggestionsBar
