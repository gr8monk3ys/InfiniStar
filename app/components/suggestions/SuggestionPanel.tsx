"use client"

import { useCallback, useState } from "react"
import {
  HiArrowPath,
  HiChatBubbleBottomCenterText,
  HiChevronDown,
  HiChevronUp,
  HiQuestionMarkCircle,
  HiSparkles,
} from "react-icons/hi2"

import { cn } from "@/app/lib/utils"
import { Button } from "@/app/components/ui/button"
import { type Suggestion, type SuggestionType } from "@/app/hooks/useSuggestions"

import { SuggestionCard } from "./SuggestionCard"

/**
 * Props for SuggestionPanel component
 */
interface SuggestionPanelProps {
  /** Array of suggestions to display */
  suggestions: Suggestion[]
  /** Current suggestion type */
  currentType: SuggestionType | null
  /** Callback when a suggestion is selected */
  onSelect: (text: string) => void
  /** Callback to fetch suggestions for a type */
  onFetchType: (type: SuggestionType) => void
  /** Whether suggestions are loading */
  isLoading?: boolean
  /** Callback to refresh suggestions */
  onRefresh?: () => void
  /** Whether the panel is disabled */
  disabled?: boolean
  /** Whether the panel is expanded by default */
  defaultExpanded?: boolean
  /** Additional CSS classes */
  className?: string
}

/**
 * Suggestion type tab data
 */
const SUGGESTION_TABS: {
  type: SuggestionType
  label: string
  description: string
  icon: React.ReactNode
}[] = [
  {
    type: "reply",
    label: "Replies",
    description: "Suggested responses",
    icon: <HiChatBubbleBottomCenterText className="size-4" aria-hidden="true" />,
  },
  {
    type: "question",
    label: "Questions",
    description: "Follow-up questions",
    icon: <HiQuestionMarkCircle className="size-4" aria-hidden="true" />,
  },
  {
    type: "continue",
    label: "Continue",
    description: "Complete your thought",
    icon: <HiSparkles className="size-4" aria-hidden="true" />,
  },
  {
    type: "rephrase",
    label: "Rephrase",
    description: "Different wording",
    icon: <HiArrowPath className="size-4" aria-hidden="true" />,
  },
]

/**
 * An expandable panel that displays categorized suggestions.
 * Allows users to switch between different suggestion types.
 */
export function SuggestionPanel({
  suggestions,
  currentType,
  onSelect,
  onFetchType,
  isLoading = false,
  onRefresh,
  disabled = false,
  defaultExpanded = false,
  className,
}: SuggestionPanelProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded)

  const handleTabClick = useCallback(
    (type: SuggestionType) => {
      if (!disabled && type !== currentType) {
        onFetchType(type)
      }
    },
    [disabled, currentType, onFetchType]
  )

  const toggleExpanded = useCallback(() => {
    setIsExpanded((prev) => !prev)
  }, [])

  return (
    <div className={cn("rounded-lg border border-border bg-background shadow-sm", className)}>
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <button
          type="button"
          onClick={toggleExpanded}
          className="flex flex-1 items-center gap-2 text-sm font-medium text-foreground"
          aria-expanded={isExpanded}
          aria-controls="suggestion-panel-content"
        >
          <HiSparkles className="size-4 text-amber-500" aria-hidden="true" />
          <span>AI Suggestions</span>
          {isExpanded ? (
            <HiChevronUp className="size-4 text-muted-foreground" aria-hidden="true" />
          ) : (
            <HiChevronDown className="size-4 text-muted-foreground" aria-hidden="true" />
          )}
        </button>

        {onRefresh && isExpanded && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onRefresh}
            disabled={disabled || isLoading}
            className="size-7 p-0"
            aria-label="Refresh suggestions"
          >
            <HiArrowPath
              className={cn("size-3.5", isLoading && "animate-spin")}
              aria-hidden="true"
            />
          </Button>
        )}
      </div>

      {/* Expandable content */}
      {isExpanded && (
        <div id="suggestion-panel-content" className="p-3">
          {/* Type tabs */}
          <div
            className="mb-3 flex gap-1 overflow-x-auto rounded-lg bg-muted p-1"
            role="tablist"
            aria-label="Suggestion types"
          >
            {SUGGESTION_TABS.map((tab) => (
              <button
                key={tab.type}
                type="button"
                role="tab"
                aria-selected={currentType === tab.type}
                aria-controls={`suggestions-${tab.type}`}
                onClick={() => handleTabClick(tab.type)}
                disabled={disabled}
                className={cn(
                  "flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium transition-colors",
                  "focus:outline-none focus:ring-2 focus:ring-ring",
                  currentType === tab.type
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                  disabled && "cursor-not-allowed opacity-50"
                )}
              >
                {tab.icon}
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            ))}
          </div>

          {/* Suggestions grid */}
          <div
            id={`suggestions-${currentType}`}
            role="tabpanel"
            aria-labelledby={currentType ? `tab-${currentType}` : undefined}
            className="space-y-2"
          >
            {isLoading ? (
              // Loading skeleton
              <div className="grid gap-2">
                {[1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className="h-12 animate-pulse rounded-lg bg-muted"
                    aria-hidden="true"
                  />
                ))}
              </div>
            ) : suggestions.length > 0 ? (
              // Suggestions list
              <div className="grid gap-2">
                {suggestions.map((suggestion) => (
                  <SuggestionCard
                    key={suggestion.id}
                    suggestion={suggestion}
                    onSelect={onSelect}
                    disabled={disabled}
                  />
                ))}
              </div>
            ) : (
              // Empty state
              <div className="py-6 text-center text-sm text-muted-foreground">
                <p>No suggestions available</p>
                <p className="mt-1 text-xs">
                  {currentType
                    ? `Click a tab above to generate ${currentType} suggestions`
                    : "Select a suggestion type to get started"}
                </p>
              </div>
            )}
          </div>

          {/* Current type description */}
          {currentType && (
            <p className="mt-3 text-center text-xs text-muted-foreground">
              {SUGGESTION_TABS.find((t) => t.type === currentType)?.description}
            </p>
          )}
        </div>
      )}
    </div>
  )
}

export default SuggestionPanel
