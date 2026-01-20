"use client"

import { useCallback, useEffect, useState } from "react"
import { formatDistanceToNow } from "date-fns"
import { HiClock, HiOutlineTrash, HiOutlineXMark } from "react-icons/hi2"

import { MAX_RECENT_SEARCHES, RECENT_SEARCHES_KEY, type RecentSearch } from "@/app/types/search"

interface RecentSearchesProps {
  onSelect: (query: string) => void
  onClear?: () => void
  className?: string
}

/**
 * RecentSearches Component
 *
 * Displays and manages the user's recent search history.
 * Searches are stored in localStorage with the ability to:
 * - Click to re-run a search
 * - Delete individual searches
 * - Clear all search history
 */
export function RecentSearches({ onSelect, onClear, className = "" }: RecentSearchesProps) {
  const [recentSearches, setRecentSearches] = useState<RecentSearch[]>([])
  const [isLoaded, setIsLoaded] = useState(false)

  // Load recent searches from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(RECENT_SEARCHES_KEY)
      if (stored) {
        const parsed = JSON.parse(stored) as RecentSearch[]
        setRecentSearches(parsed)
      }
    } catch (error) {
      console.error("Failed to load recent searches:", error)
    }
    setIsLoaded(true)
  }, [])

  // Delete a single search from history
  const handleDelete = useCallback((id: string, e: React.MouseEvent) => {
    e.stopPropagation()

    setRecentSearches((prev) => {
      const updated = prev.filter((search) => search.id !== id)
      try {
        localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated))
      } catch (error) {
        console.error("Failed to save recent searches:", error)
      }
      return updated
    })
  }, [])

  // Clear all search history
  const handleClearAll = useCallback(() => {
    setRecentSearches([])
    try {
      localStorage.removeItem(RECENT_SEARCHES_KEY)
    } catch (error) {
      console.error("Failed to clear recent searches:", error)
    }
    onClear?.()
  }, [onClear])

  // Format timestamp for display
  const formatTime = useCallback((timestamp: number) => {
    try {
      return formatDistanceToNow(new Date(timestamp), { addSuffix: true })
    } catch {
      return ""
    }
  }, [])

  // Don't render until loaded to avoid hydration mismatch
  if (!isLoaded) {
    return null
  }

  if (recentSearches.length === 0) {
    return null
  }

  return (
    <div className={`${className}`}>
      {/* Header */}
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <HiClock className="size-4 text-gray-400" />
          <span className="text-xs font-medium text-gray-500">Recent searches</span>
        </div>
        <button
          type="button"
          onClick={handleClearAll}
          className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600"
          aria-label="Clear all recent searches"
        >
          <HiOutlineTrash className="size-3" />
          Clear all
        </button>
      </div>

      {/* Search list */}
      <ul className="space-y-1" role="list" aria-label="Recent searches">
        {recentSearches.map((search) => (
          <li key={search.id}>
            <button
              type="button"
              onClick={() => onSelect(search.query)}
              className="group flex w-full items-center gap-3 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-gray-100"
            >
              {/* Query text */}
              <span className="min-w-0 flex-1 truncate text-sm text-gray-700">{search.query}</span>

              {/* Result count badge */}
              {search.resultCount !== undefined && (
                <span className="shrink-0 text-xs text-gray-400">
                  {search.resultCount} result{search.resultCount !== 1 ? "s" : ""}
                </span>
              )}

              {/* Timestamp */}
              <span className="shrink-0 text-xs text-gray-400">{formatTime(search.timestamp)}</span>

              {/* Delete button */}
              <button
                type="button"
                onClick={(e) => handleDelete(search.id, e)}
                className="shrink-0 rounded p-1 opacity-0 transition-opacity hover:bg-gray-200 group-hover:opacity-100"
                aria-label={`Delete search "${search.query}"`}
              >
                <HiOutlineXMark className="size-3.5 text-gray-400" />
              </button>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

/**
 * Save a search to recent history
 */
export function saveRecentSearch(query: string, resultCount?: number): void {
  try {
    const stored = localStorage.getItem(RECENT_SEARCHES_KEY)
    let searches: RecentSearch[] = stored ? JSON.parse(stored) : []

    // Remove duplicate if exists
    searches = searches.filter((s) => s.query.toLowerCase() !== query.toLowerCase())

    // Add new search at the beginning
    const newSearch: RecentSearch = {
      id: `search-${Date.now()}`,
      query,
      timestamp: Date.now(),
      resultCount,
    }

    searches.unshift(newSearch)

    // Keep only the most recent searches
    searches = searches.slice(0, MAX_RECENT_SEARCHES)

    localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(searches))
  } catch (error) {
    console.error("Failed to save recent search:", error)
  }
}

/**
 * Get recent searches from localStorage
 */
export function getRecentSearches(): RecentSearch[] {
  try {
    const stored = localStorage.getItem(RECENT_SEARCHES_KEY)
    return stored ? JSON.parse(stored) : []
  } catch {
    return []
  }
}

/**
 * Clear all recent searches
 */
export function clearRecentSearches(): void {
  try {
    localStorage.removeItem(RECENT_SEARCHES_KEY)
  } catch (error) {
    console.error("Failed to clear recent searches:", error)
  }
}

export default RecentSearches
