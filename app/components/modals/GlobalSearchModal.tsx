"use client"

import { useCallback, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import {
  HiAdjustmentsHorizontal,
  HiChevronDown,
  HiChevronLeft,
  HiChevronRight,
  HiMagnifyingGlass,
  HiOutlineChatBubbleLeftRight,
  HiOutlineXMark,
} from "react-icons/hi2"

import { useSearch } from "@/app/hooks/useSearch"
import { useTags } from "@/app/hooks/useTags"
import type { SearchResultType } from "@/app/types/search"

import {
  ConversationResultItem,
  MessageResultItem,
  RecentSearches,
  SearchFilters,
  SearchResultSkeleton,
  SearchSuggestions,
} from "../search"

interface GlobalSearchModalProps {
  isOpen: boolean
  onClose: () => void
}

/**
 * GlobalSearchModal Component
 *
 * Enhanced global search modal with:
 * - Advanced filtering (date range, AI/human, personality, tags)
 * - Auto-complete suggestions
 * - Recent search history
 * - Keyboard navigation
 * - Faceted search with result counts
 * - Sort options (relevance, date, message count)
 */
const GlobalSearchModal: React.FC<GlobalSearchModalProps> = ({ isOpen, onClose }) => {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const resultsRef = useRef<HTMLDivElement>(null)

  // Fetch user tags for filtering
  const { tags: userTags, isLoading: isTagsLoading } = useTags()

  // Use the search hook for all search functionality
  const {
    query,
    filters,
    conversationCount,
    messageCount,
    totalPages,
    suggestions,
    isSearching,
    isSuggestionsLoading,
    hasSearched,
    error,
    selectedIndex,
    selectedSuggestionIndex,
    showFilters,
    showSuggestions,
    visibleConversations,
    visibleMessages,
    debouncedQuery,
    searchTimeMs,
    setQuery,
    setFilters,
    resetFilters,
    setSelectedIndex,
    toggleFilters,
    hideSuggestions,
    reset,
    navigateUp,
    navigateDown,
    getSelectedItem,
    nextPage,
    prevPage,
  } = useSearch()

  // Focus input when modal opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [isOpen])

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      reset()
    }
  }, [isOpen, reset])

  // Handle result click - navigate to conversation
  const handleResultClick = useCallback(
    (conversationId: string) => {
      router.push(`/dashboard/conversations/${conversationId}`)
      onClose()
    },
    [router, onClose]
  )

  // Handle suggestion selection
  const handleSuggestionSelect = useCallback(
    (suggestion: { type: string; text: string }) => {
      setQuery(suggestion.text)
      hideSuggestions()
    },
    [setQuery, hideSuggestions]
  )

  // Handle recent search selection
  const handleRecentSearchSelect = useCallback(
    (searchQuery: string) => {
      setQuery(searchQuery)
    },
    [setQuery]
  )

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key === "ArrowDown") {
        event.preventDefault()
        navigateDown()
      } else if (event.key === "ArrowUp") {
        event.preventDefault()
        navigateUp()
      } else if (event.key === "Enter") {
        event.preventDefault()
        const selected = getSelectedItem()
        if (selected) {
          if (selected.type === "suggestion") {
            handleSuggestionSelect(selected.item)
          } else if (selected.type === "conversation") {
            handleResultClick(selected.item.id)
          } else if (selected.type === "message") {
            handleResultClick(selected.item.conversation.id)
          }
        }
      } else if (event.key === "Escape") {
        if (showSuggestions) {
          hideSuggestions()
        } else {
          onClose()
        }
      }
    },
    [
      navigateDown,
      navigateUp,
      getSelectedItem,
      handleSuggestionSelect,
      handleResultClick,
      showSuggestions,
      hideSuggestions,
      onClose,
    ]
  )

  // Scroll selected item into view
  useEffect(() => {
    if (selectedIndex >= 0 && resultsRef.current) {
      const selectedElement = resultsRef.current.querySelector(`[data-index="${selectedIndex}"]`)
      selectedElement?.scrollIntoView({ block: "nearest", behavior: "smooth" })
    }
  }, [selectedIndex])

  // Handle tab change
  const handleTabChange = useCallback(
    (type: SearchResultType) => {
      setFilters({ type, page: 1 })
      setSelectedIndex(-1)
    },
    [setFilters, setSelectedIndex]
  )

  if (!isOpen) return null

  const totalResults = conversationCount + messageCount
  const hasResults = totalResults > 0
  const showRecentSearches = !hasSearched && query.length < 2

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-neutral-800/70 pt-20"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="search-modal-title"
    >
      <div
        className="relative mx-4 w-full max-w-2xl rounded-lg bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* Header */}
        <div className="border-b border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <h2 id="search-modal-title" className="text-lg font-semibold text-gray-900">
              Search
            </h2>
            <div className="flex items-center gap-2">
              <kbd className="hidden rounded border border-gray-300 bg-gray-100 px-2 py-0.5 text-xs text-gray-500 sm:inline">
                ESC
              </kbd>
              <button
                type="button"
                onClick={onClose}
                className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-sky-500"
                aria-label="Close search"
              >
                <HiOutlineXMark size={24} />
              </button>
            </div>
          </div>

          {/* Search Input */}
          <div className="relative mt-4">
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                <HiMagnifyingGlass
                  className={`size-5 ${
                    isSearching ? "animate-pulse text-sky-500" : "text-gray-400"
                  }`}
                />
              </div>
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onFocus={() => query.length >= 2 && !hasSearched && hideSuggestions()}
                placeholder="Search conversations and messages..."
                className="block w-full rounded-lg border border-gray-300 py-3 pl-10 pr-24 text-base focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                aria-label="Search query"
                aria-describedby="search-hint"
                autoComplete="off"
              />
              <div className="absolute inset-y-0 right-0 flex items-center gap-1 pr-2">
                {/* Filter toggle button */}
                <button
                  type="button"
                  onClick={toggleFilters}
                  className={`flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-colors ${
                    showFilters
                      ? "bg-sky-100 text-sky-700"
                      : "text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                  }`}
                  aria-expanded={showFilters}
                  aria-label={showFilters ? "Hide filters" : "Show filters"}
                >
                  <HiAdjustmentsHorizontal className="size-4" />
                  <HiChevronDown
                    className={`size-3 transition-transform ${showFilters ? "rotate-180" : ""}`}
                  />
                </button>
                <kbd className="hidden rounded border border-gray-300 bg-gray-100 px-2 py-0.5 text-xs text-gray-500 sm:inline">
                  Cmd+K
                </kbd>
              </div>
            </div>
            <p id="search-hint" className="mt-1 text-xs text-gray-500">
              Type at least 2 characters to search
              {searchTimeMs !== undefined && hasSearched && (
                <span className="ml-2 text-gray-400">({searchTimeMs}ms)</span>
              )}
            </p>

            {/* Suggestions dropdown */}
            {showSuggestions && suggestions.length > 0 && (
              <div className="absolute inset-x-0 top-full z-10 mt-1">
                <SearchSuggestions
                  suggestions={suggestions}
                  onSelect={handleSuggestionSelect}
                  selectedIndex={selectedSuggestionIndex}
                  isLoading={isSuggestionsLoading}
                />
              </div>
            )}
          </div>

          {/* Filters Panel (collapsible) */}
          {showFilters && (
            <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50 p-4">
              <SearchFilters
                filters={filters}
                onFiltersChange={setFilters}
                tags={userTags}
                isLoading={isSearching || isTagsLoading}
                onClearAll={resetFilters}
              />
            </div>
          )}

          {/* Tabs with result counts */}
          {hasSearched && hasResults && (
            <div
              className="mt-4 flex gap-1 border-b border-gray-200"
              role="tablist"
              aria-label="Search result types"
            >
              <button
                id="search-tab-all"
                role="tab"
                aria-selected={filters.type === "all"}
                aria-controls="search-results-panel"
                onClick={() => handleTabChange("all")}
                className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium ${
                  filters.type === "all"
                    ? "border-b-2 border-sky-500 text-sky-600"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                All
                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs">{totalResults}</span>
              </button>
              <button
                id="search-tab-conversations"
                role="tab"
                aria-selected={filters.type === "conversations"}
                aria-controls="search-results-panel"
                onClick={() => handleTabChange("conversations")}
                className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium ${
                  filters.type === "conversations"
                    ? "border-b-2 border-sky-500 text-sky-600"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                <HiOutlineChatBubbleLeftRight className="size-4" />
                Conversations
                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs">
                  {conversationCount}
                </span>
              </button>
              <button
                id="search-tab-messages"
                role="tab"
                aria-selected={filters.type === "messages"}
                aria-controls="search-results-panel"
                onClick={() => handleTabChange("messages")}
                className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium ${
                  filters.type === "messages"
                    ? "border-b-2 border-sky-500 text-sky-600"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                <HiMagnifyingGlass className="size-4" />
                Messages
                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs">{messageCount}</span>
              </button>
            </div>
          )}
        </div>

        {/* Results */}
        <div
          ref={resultsRef}
          id="search-results-panel"
          className="max-h-[50vh] overflow-y-auto p-4"
          role="listbox"
          aria-label="Search results"
          aria-labelledby={`search-tab-${filters.type}`}
        >
          {/* Loading State */}
          {isSearching && (
            <div className="space-y-3">
              <SearchResultSkeleton />
              <SearchResultSkeleton />
              <SearchResultSkeleton />
            </div>
          )}

          {/* Error State */}
          {error && !isSearching && (
            <div className="py-8 text-center">
              <p className="text-sm text-red-500">{error}</p>
              <button
                type="button"
                onClick={() => setQuery(query)}
                className="mt-2 text-sm text-sky-600 hover:text-sky-700"
              >
                Try again
              </button>
            </div>
          )}

          {/* No Results */}
          {hasSearched && !isSearching && !error && !hasResults && (
            <div className="py-8 text-center">
              <HiMagnifyingGlass className="mx-auto size-12 text-gray-300" />
              <p className="mt-2 text-sm text-gray-500">
                No results found for &quot;{debouncedQuery}&quot;
              </p>
              <p className="mt-1 text-xs text-gray-400">
                Try different keywords or adjust your filters
              </p>
              {showFilters && (
                <button
                  type="button"
                  onClick={resetFilters}
                  className="mt-3 text-sm font-medium text-sky-600 hover:text-sky-700"
                >
                  Clear all filters
                </button>
              )}
            </div>
          )}

          {/* Conversations Section */}
          {!isSearching && visibleConversations.length > 0 && (
            <div className="mb-4">
              {filters.type === "all" && (
                <h3 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                  <HiOutlineChatBubbleLeftRight className="size-4" />
                  Conversations ({conversationCount})
                </h3>
              )}
              <div className="space-y-2">
                {visibleConversations.map((conv, index) => (
                  <ConversationResultItem
                    key={conv.id}
                    conversation={conv}
                    onClick={() => handleResultClick(conv.id)}
                    isSelected={selectedIndex === index}
                    dataIndex={index}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Messages Section */}
          {!isSearching && visibleMessages.length > 0 && (
            <div>
              {filters.type === "all" && visibleConversations.length > 0 && (
                <hr className="my-4 border-gray-200" />
              )}
              {filters.type === "all" && (
                <h3 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                  <HiMagnifyingGlass className="size-4" />
                  Messages ({messageCount})
                </h3>
              )}
              <div className="space-y-2">
                {visibleMessages.map((msg, index) => {
                  const resultIndex = visibleConversations.length + index
                  return (
                    <MessageResultItem
                      key={msg.id}
                      message={msg}
                      onClick={() => handleResultClick(msg.conversation.id)}
                      isSelected={selectedIndex === resultIndex}
                      dataIndex={resultIndex}
                    />
                  )
                })}
              </div>
            </div>
          )}

          {/* Recent Searches (shown when no active search) */}
          {showRecentSearches && !isSearching && (
            <RecentSearches onSelect={handleRecentSearchSelect} className="mb-4" />
          )}

          {/* Initial State */}
          {!hasSearched && !isSearching && query.length < 2 && (
            <div className="py-8 text-center">
              <HiMagnifyingGlass className="mx-auto size-12 text-gray-300" />
              <p className="mt-2 text-sm text-gray-500">
                Search across all your conversations and messages
              </p>
              <p className="mt-1 text-xs text-gray-400">
                Use filters to narrow down results by date, type, or tags
              </p>
            </div>
          )}
        </div>

        {/* Footer with pagination and keyboard hints */}
        <div className="border-t border-gray-200 bg-gray-50 px-4 py-3">
          <div className="flex items-center justify-between">
            {/* Pagination */}
            {hasSearched && totalPages > 1 && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={prevPage}
                  disabled={filters.page <= 1}
                  className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-50"
                  aria-label="Previous page"
                >
                  <HiChevronLeft className="size-4" />
                  Prev
                </button>
                <span className="text-xs text-gray-500">
                  Page {filters.page} of {totalPages}
                </span>
                <button
                  type="button"
                  onClick={nextPage}
                  disabled={filters.page >= totalPages}
                  className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-50"
                  aria-label="Next page"
                >
                  Next
                  <HiChevronRight className="size-4" />
                </button>
              </div>
            )}

            {/* Keyboard hints */}
            <div className="flex items-center gap-4 text-xs text-gray-500">
              <span className="flex items-center gap-1">
                <kbd className="rounded border border-gray-300 bg-white px-1">Up</kbd>
                <kbd className="rounded border border-gray-300 bg-white px-1">Down</kbd>
                <span className="ml-1">to navigate</span>
              </span>
              <span className="flex items-center gap-1">
                <kbd className="rounded border border-gray-300 bg-white px-1">Enter</kbd>
                <span className="ml-1">to select</span>
              </span>
              <span className="hidden sm:flex sm:items-center sm:gap-1">
                <kbd className="rounded border border-gray-300 bg-white px-1">Esc</kbd>
                <span className="ml-1">to close</span>
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default GlobalSearchModal
