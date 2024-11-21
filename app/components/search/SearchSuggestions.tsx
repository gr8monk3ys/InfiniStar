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
      return <HiOutlineChatBubbleLeftRight className="size-4 text-sky-500" />
    case "message":
      return <HiOutlineDocumentText className="size-4 text-gray-500" />
    case "tag":
      return <HiOutlineTag className="size-4 text-purple-500" />
    case "recent":
      return <HiClock className="size-4 text-gray-400" />
    default:
      return <HiOutlineDocumentText className="size-4 text-gray-500" />
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
              className="rounded bg-yellow-200 px-0.5 font-medium text-gray-900"
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
      <div className={`rounded-lg border border-gray-200 bg-white p-2 shadow-lg ${className}`}>
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-3 px-3 py-2">
              <div className="size-4 animate-pulse rounded bg-gray-200" />
              <div className="h-4 flex-1 animate-pulse rounded bg-gray-200" />
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
      className={`rounded-lg border border-gray-200 bg-white shadow-lg ${className}`}
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
                  ? "bg-sky-50 text-sky-900"
                  : "text-gray-700 hover:bg-gray-50"
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
                  <p className="truncate text-xs text-gray-500">{suggestion.context}</p>
                )}
              </div>

              {/* Type badge */}
              <span className="shrink-0 rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium capitalize text-gray-500">
                {suggestion.type}
              </span>
            </button>
          </li>
        ))}
      </ul>

      {/* Footer hint */}
      <div className="border-t border-gray-100 px-3 py-2">
        <p className="text-xs text-gray-400">
          Press <kbd className="rounded border border-gray-200 bg-gray-50 px-1">Enter</kbd> to
          select or <kbd className="rounded border border-gray-200 bg-gray-50 px-1">Esc</kbd> to
          dismiss
        </p>
      </div>
    </div>
  )
}

export default SearchSuggestions
