"use client"

import {
  HiClock,
  HiOutlineChatBubbleLeftRight,
  HiOutlineDocumentText,
  HiOutlineTag,
} from "react-icons/hi2"

import type { SearchSuggestion } from "@/app/types/search"

interface SearchSuggestionsProps {
  suggestions: SearchSuggestion[]
  onSelect: (suggestion: SearchSuggestion) => void
  selectedIndex: number
  isLoading?: boolean
  className?: string
}

/**
 * Get icon for suggestion type
 */
function getSuggestionIcon(type: SearchSuggestion["type"]) {
  switch (type) {
    case "conversation":
      return <HiOutlineChatBubbleLeftRight className="size-4 text-primary" />
    case "message":
      return <HiOutlineDocumentText className="size-4 text-muted-foreground" />
    case "tag":
      return <HiOutlineTag className="size-4 text-primary" />
    case "recent":
      return <HiClock className="size-4 text-muted-foreground/70" />
    default:
      return <HiOutlineDocumentText className="size-4 text-muted-foreground" />
  }
}

/**
 * Render highlighted text with [hl]...[/hl] markers
 */
function HighlightedText({ text }: { text: string }) {
  const parts = text.split(/\[hl\]|\[\/hl\]/)
  /* eslint-disable react/no-array-index-key */
  return (
    <>
      {parts.map((part, index) => {
        if (index % 2 === 1) {
          return (
            <mark
              key={`hl-${index}`}
              className="rounded-sm bg-primary/20 px-0.5 font-medium text-foreground"
            >
              {part}
            </mark>
          )
        }
        return <span key={`text-${index}`}>{part}</span>
      })}
    </>
  )
  /* eslint-enable react/no-array-index-key */
}

/**
 * SearchSuggestions Component
 *
 * Displays auto-complete suggestions based on the current search query.
 * Shows different types of suggestions (conversations, tags, recent searches)
 * with appropriate icons and highlighting.
 */
export function SearchSuggestions({
  suggestions,
  onSelect,
  selectedIndex,
  isLoading = false,
  className = "",
}: SearchSuggestionsProps) {
  if (isLoading) {
    return (
      <div className={`rounded-lg border border-border bg-popover p-2 shadow-lg ${className}`}>
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-3 px-3 py-2">
              <div className="size-4 animate-pulse rounded bg-muted" />
              <div className="h-4 flex-1 animate-pulse rounded bg-muted" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (suggestions.length === 0) {
    return null
  }

  return (
    <div
      className={`rounded-lg border border-border bg-popover shadow-lg ${className}`}
      role="listbox"
      aria-label="Search suggestions"
    >
      <ul className="max-h-64 overflow-y-auto py-1">
        {suggestions.map((suggestion, index) => (
          <li key={suggestion.id}>
            <button
              type="button"
              onClick={() => onSelect(suggestion)}
              className={`flex w-full items-center gap-3 px-3 py-2 text-left transition-colors ${
                index === selectedIndex
                  ? "bg-primary/10 text-primary"
                  : "text-foreground hover:bg-accent hover:text-accent-foreground"
              }`}
              role="option"
              aria-selected={index === selectedIndex}
            >
              {/* Icon */}
              <span className="shrink-0">{getSuggestionIcon(suggestion.type)}</span>

              {/* Text content */}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm">
                  {suggestion.highlightedText ? (
                    <HighlightedText text={suggestion.highlightedText} />
                  ) : (
                    suggestion.text
                  )}
                </p>
                {suggestion.context && (
                  <p className="truncate text-xs text-muted-foreground">{suggestion.context}</p>
                )}
              </div>

              {/* Type badge */}
              <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-xs font-medium capitalize text-muted-foreground">
                {suggestion.type}
              </span>
            </button>
          </li>
        ))}
      </ul>

      {/* Footer hint */}
      <div className="border-t border-border px-3 py-2">
        <p className="text-xs text-muted-foreground/70">
          Press <kbd className="rounded border-border bg-muted px-1">Enter</kbd> to select or{" "}
          <kbd className="rounded border-border bg-muted px-1">Esc</kbd> to dismiss
        </p>
      </div>
    </div>
  )
}

export default SearchSuggestions
