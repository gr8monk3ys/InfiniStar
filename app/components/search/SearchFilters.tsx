"use client"

import { useCallback } from "react"
import {
  HiAdjustmentsHorizontal,
  HiOutlineArchiveBox,
  HiOutlinePhoto,
  HiOutlineTag,
  HiOutlineXMark,
  HiSparkles,
  HiUser,
} from "react-icons/hi2"

import { TAG_COLORS, type TagColor, type TagWithCount } from "@/app/types"
import type {
  AdvancedSearchFilters,
  AIPersonality,
  SearchResultType,
  SearchSortBy,
} from "@/app/types/search"

import { DateRangePicker } from "./DateRangePicker"

interface SearchFiltersProps {
  filters: AdvancedSearchFilters
  onFiltersChange: (filters: Partial<AdvancedSearchFilters>) => void
  tags: TagWithCount[]
  isLoading?: boolean
  onClearAll: () => void
  className?: string
}

/**
 * AI personality options for the dropdown
 */
const AI_PERSONALITIES: { value: AIPersonality; label: string }[] = [
  { value: "helpful", label: "Helpful" },
  { value: "concise", label: "Concise" },
  { value: "creative", label: "Creative" },
  { value: "analytical", label: "Analytical" },
  { value: "empathetic", label: "Empathetic" },
  { value: "professional", label: "Professional" },
  { value: "custom", label: "Custom" },
]

/**
 * Sort options for the dropdown
 */
const SORT_OPTIONS: { value: SearchSortBy; label: string }[] = [
  { value: "relevance", label: "Most Relevant" },
  { value: "date", label: "Most Recent" },
  { value: "messageCount", label: "Most Messages" },
]

/**
 * SearchFilters Component
 *
 * A comprehensive filter panel for advanced search functionality.
 * Includes filters for:
 * - Result type (all, conversations, messages)
 * - Date range
 * - AI/Human conversations
 * - AI personality
 * - Tags
 * - Attachments
 * - Archived items
 * - Sort order
 */
export function SearchFilters({
  filters,
  onFiltersChange,
  tags,
  isLoading = false,
  onClearAll,
  className = "",
}: SearchFiltersProps) {
  // Count active filters
  const activeFilterCount = [
    filters.dateFrom || filters.dateTo,
    filters.isAI !== undefined,
    filters.personality,
    filters.tagIds && filters.tagIds.length > 0,
    filters.hasAttachments,
    filters.archived,
    filters.sortBy !== "relevance",
  ].filter(Boolean).length

  // Toggle AI filter
  const handleAIToggle = useCallback(
    (value: "all" | "ai" | "human") => {
      if (value === "all") {
        onFiltersChange({ isAI: undefined, personality: undefined })
      } else if (value === "ai") {
        onFiltersChange({ isAI: true })
      } else {
        onFiltersChange({ isAI: false, personality: undefined })
      }
    },
    [onFiltersChange]
  )

  // Toggle tag selection
  const handleTagToggle = useCallback(
    (tagId: string) => {
      const currentTags = filters.tagIds || []
      const newTags = currentTags.includes(tagId)
        ? currentTags.filter((id) => id !== tagId)
        : [...currentTags, tagId]

      onFiltersChange({ tagIds: newTags.length > 0 ? newTags : undefined })
    },
    [filters.tagIds, onFiltersChange]
  )

  // Clear date range
  const handleClearDateRange = useCallback(() => {
    onFiltersChange({ dateFrom: undefined, dateTo: undefined })
  }, [onFiltersChange])

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Header with filter count and clear button */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <HiAdjustmentsHorizontal className="size-4 text-muted-foreground" />
          <span className="text-sm font-medium text-foreground">Filters</span>
          {activeFilterCount > 0 && (
            <span className="flex size-5 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary-accent">
              {activeFilterCount}
            </span>
          )}
        </div>
        {activeFilterCount > 0 && (
          <button
            type="button"
            onClick={onClearAll}
            disabled={isLoading}
            className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground disabled:opacity-50"
            aria-label="Clear all filters"
          >
            <HiOutlineXMark className="size-3.5" />
            Clear all
          </button>
        )}
      </div>

      {/* Result type tabs */}
      <div>
        <label className="mb-1.5 block text-xs font-medium text-foreground">
          Show results from
        </label>
        <div className="flex rounded-lg border border-border p-0.5">
          {(["all", "conversations", "messages"] as SearchResultType[]).map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => onFiltersChange({ type })}
              disabled={isLoading}
              className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
                filters.type === type
                  ? "bg-primary/10 text-primary-accent"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              } disabled:opacity-50`}
              aria-pressed={filters.type === type}
            >
              {type}
            </button>
          ))}
        </div>
      </div>

      {/* AI/Human toggle */}
      <div>
        <label className="mb-1.5 block text-xs font-medium text-foreground">
          Conversation type
        </label>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => handleAIToggle("all")}
            disabled={isLoading}
            className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
              filters.isAI === undefined
                ? "border-primary/20 bg-primary/10 text-primary-accent"
                : "border-border text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            } disabled:opacity-50`}
            aria-pressed={filters.isAI === undefined}
          >
            All
          </button>
          <button
            type="button"
            onClick={() => handleAIToggle("ai")}
            disabled={isLoading}
            className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
              filters.isAI === true
                ? "border-primary/20 bg-primary/10 text-primary-accent"
                : "border-border text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            } disabled:opacity-50`}
            aria-pressed={filters.isAI === true}
          >
            <HiSparkles className="size-3.5" />
            AI
          </button>
          <button
            type="button"
            onClick={() => handleAIToggle("human")}
            disabled={isLoading}
            className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
              filters.isAI === false
                ? "border-green-300 bg-green-50 text-green-700"
                : "border-border text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            } disabled:opacity-50`}
            aria-pressed={filters.isAI === false}
          >
            <HiUser className="size-3.5" />
            Human
          </button>
        </div>
      </div>

      {/* AI Personality dropdown (only when AI filter is active) */}
      {filters.isAI === true && (
        <div>
          <label
            htmlFor="personality-filter"
            className="mb-1.5 block text-xs font-medium text-foreground"
          >
            AI Personality
          </label>
          <select
            id="personality-filter"
            value={filters.personality || ""}
            onChange={(e) =>
              onFiltersChange({
                personality: e.target.value ? (e.target.value as AIPersonality) : undefined,
              })
            }
            disabled={isLoading}
            className="block w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50"
          >
            <option value="">All personalities</option>
            {AI_PERSONALITIES.map((personality) => (
              <option key={personality.value} value={personality.value}>
                {personality.label}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Date range picker */}
      <div>
        <label className="mb-1.5 block text-xs font-medium text-foreground">Date range</label>
        <DateRangePicker
          dateFrom={filters.dateFrom || ""}
          dateTo={filters.dateTo || ""}
          onDateFromChange={(date) => onFiltersChange({ dateFrom: date || undefined })}
          onDateToChange={(date) => onFiltersChange({ dateTo: date || undefined })}
          onClear={handleClearDateRange}
        />
      </div>

      {/* Tag filter */}
      {tags.length > 0 && (
        <div>
          <label className="mb-1.5 flex items-center gap-1 text-xs font-medium text-foreground">
            <HiOutlineTag className="size-3.5" />
            Tags
          </label>
          <div className="flex flex-wrap gap-1.5">
            {tags.map((tag) => {
              const colorScheme = TAG_COLORS[tag.color as TagColor] || TAG_COLORS.gray
              const isSelected = filters.tagIds?.includes(tag.id)
              return (
                <button
                  key={tag.id}
                  type="button"
                  onClick={() => handleTagToggle(tag.id)}
                  disabled={isLoading}
                  className={`flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
                    colorScheme.bg
                  } ${colorScheme.text} ${colorScheme.border} ${
                    isSelected
                      ? "ring-2 ring-current ring-offset-1"
                      : "opacity-70 hover:opacity-100"
                  } disabled:cursor-not-allowed`}
                  aria-pressed={isSelected}
                >
                  {tag.name}
                  {tag.conversationCount > 0 && (
                    <span className="text-xs opacity-70">({tag.conversationCount})</span>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Additional filters */}
      <div className="flex flex-wrap gap-2">
        {/* Has attachments toggle */}
        <button
          type="button"
          onClick={() => onFiltersChange({ hasAttachments: !filters.hasAttachments })}
          disabled={isLoading}
          className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
            filters.hasAttachments
              ? "border-amber-300 bg-amber-50 text-amber-700"
              : "border-border text-muted-foreground hover:bg-accent hover:text-accent-foreground"
          } disabled:opacity-50`}
          aria-pressed={filters.hasAttachments}
        >
          <HiOutlinePhoto className="size-3.5" />
          Has images
        </button>

        {/* Include archived toggle */}
        <button
          type="button"
          onClick={() => onFiltersChange({ archived: !filters.archived })}
          disabled={isLoading}
          className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
            filters.archived
              ? "border-border bg-muted text-foreground"
              : "border-border text-muted-foreground hover:bg-accent hover:text-accent-foreground"
          } disabled:opacity-50`}
          aria-pressed={filters.archived}
        >
          <HiOutlineArchiveBox className="size-3.5" />
          Include archived
        </button>
      </div>

      {/* Sort options */}
      <div>
        <label htmlFor="sort-filter" className="mb-1.5 block text-xs font-medium text-foreground">
          Sort by
        </label>
        <select
          id="sort-filter"
          value={filters.sortBy}
          onChange={(e) => onFiltersChange({ sortBy: e.target.value as SearchSortBy })}
          disabled={isLoading}
          className="block w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50"
        >
          {SORT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}

export default SearchFilters
