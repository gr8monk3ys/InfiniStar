"use client"

import { useCallback, useState } from "react"
import { HiClock, HiOutlineTrash, HiOutlineXMark } from "react-icons/hi2"

import { formatRelative } from "@/app/lib/intl-format"
import {
  LEGACY_RECENT_SEARCHES_KEY,
  MAX_RECENT_SEARCHES,
  RECENT_SEARCHES_KEY,
  type RecentSearch,
} from "@/app/types/search"

interface RecentSearchesProps {
  onSelect: (query: string) => void
  onClear?: () => void
  className?: string
}

function readStoredSearches(): RecentSearch[] {
  if (typeof window === "undefined") return []
  try {
    let stored = localStorage.getItem(RECENT_SEARCHES_KEY)
    if (!stored) {
      // One-time move from the unversioned key so existing history survives.
      stored = localStorage.getItem(LEGACY_RECENT_SEARCHES_KEY)
      if (stored) {
        localStorage.setItem(RECENT_SEARCHES_KEY, stored)
        localStorage.removeItem(LEGACY_RECENT_SEARCHES_KEY)
      }
    }
    if (!stored) return []
    const parsed: unknown = JSON.parse(stored)
    return Array.isArray(parsed) ? (parsed as RecentSearch[]) : []
  } catch (error) {
    console.error("Failed to load recent searches:", error)
    return []
  }
}

function writeStoredSearches(searches: RecentSearch[]): void {
  try {
    if (searches.length === 0) {
      localStorage.removeItem(RECENT_SEARCHES_KEY)
    } else {
      localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(searches))
    }
  } catch (error) {
    console.error("Failed to save recent searches:", error)
  }
}

function formatSearchTime(timestamp: number): string {
  try {
    return formatRelative(timestamp)
  } catch {
    return ""
  }
}

/**
 * RecentSearches Component
 *
 * Displays and manages the user's recent search history.
 * Searches are stored in localStorage with the ability to:
 * - Click to re-run a search
 * - Delete individual searches
 * - Clear all search history (with an undo)
 *
 * Only rendered inside the client-only search dialog, so history is read from
 * storage once, on the first render, instead of after mount.
 */
export function RecentSearches({ onSelect, onClear, className = "" }: RecentSearchesProps) {
  const [recentSearches, setRecentSearches] = useState<RecentSearch[]>(readStoredSearches)
  // The list as it was before the last removal, so the removal can be undone.
  const [undoSnapshot, setUndoSnapshot] = useState<RecentSearch[] | null>(null)

  const updateSearches = useCallback(
    (next: RecentSearch[]) => {
      setUndoSnapshot(recentSearches)
      setRecentSearches(next)
      writeStoredSearches(next)
    },
    [recentSearches]
  )

  // Delete a single search from history
  const handleDelete = useCallback(
    (id: string) => {
      updateSearches(recentSearches.filter((search) => search.id !== id))
    },
    [recentSearches, updateSearches]
  )

  // Clear all search history
  const handleClearAll = useCallback(() => {
    updateSearches([])
    onClear?.()
  }, [onClear, updateSearches])

  const handleUndo = useCallback(() => {
    if (!undoSnapshot) return
    setRecentSearches(undoSnapshot)
    writeStoredSearches(undoSnapshot)
    setUndoSnapshot(null)
  }, [undoSnapshot])

  const undoButton = undoSnapshot ? (
    <button
      type="button"
      onClick={handleUndo}
      className="text-xs font-medium text-primary-accent hover:underline"
    >
      Undo
    </button>
  ) : null

  if (recentSearches.length === 0) {
    if (!undoSnapshot) return null

    return (
      <div className={`flex items-center justify-between ${className}`} role="status">
        <span className="text-xs text-muted-foreground">Search history cleared.</span>
        {undoButton}
      </div>
    )
  }

  return (
    <div className={className}>
      {/* Header */}
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <HiClock className="size-4 text-muted-foreground/70" aria-hidden="true" />
          <span className="text-xs font-medium text-muted-foreground">Recent Searches</span>
        </div>
        <div className="flex items-center gap-3">
          {undoButton}
          <button
            type="button"
            onClick={handleClearAll}
            className="flex items-center gap-1 text-xs text-muted-foreground/70 hover:text-muted-foreground"
            aria-label="Clear all recent searches"
          >
            <HiOutlineTrash className="size-3" aria-hidden="true" />
            Clear All
          </button>
        </div>
      </div>

      {/* Search list */}
      <ul className="space-y-1" role="list" aria-label="Recent searches">
        {recentSearches.map((search) => (
          <li
            key={search.id}
            className="group flex items-center gap-1 rounded-md transition-colors hover:bg-accent"
          >
            <button
              type="button"
              onClick={() => onSelect(search.query)}
              className="flex min-w-0 flex-1 items-center gap-3 rounded-md px-2 py-1.5 text-left"
            >
              {/* Query text */}
              <span className="min-w-0 flex-1 truncate text-sm text-foreground">
                {search.query}
              </span>

              {/* Result count badge */}
              {search.resultCount !== undefined && (
                <span className="shrink-0 text-xs tabular-nums text-muted-foreground/70">
                  {search.resultCount} result{search.resultCount !== 1 ? "s" : ""}
                </span>
              )}

              {/* Timestamp */}
              <span className="shrink-0 text-xs text-muted-foreground/70">
                {formatSearchTime(search.timestamp)}
              </span>
            </button>

            {/* Delete button: a sibling, not nested inside the select button */}
            <button
              type="button"
              onClick={() => handleDelete(search.id)}
              className="mr-1 shrink-0 rounded p-1 opacity-0 transition-opacity hover:bg-border focus-visible:opacity-100 group-hover:opacity-100"
              aria-label={`Delete search “${search.query}”`}
            >
              <HiOutlineXMark className="size-3.5 text-muted-foreground/70" aria-hidden="true" />
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
    let searches = readStoredSearches()

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
  return readStoredSearches()
}

/**
 * Clear all recent searches
 */
export function clearRecentSearches(): void {
  try {
    localStorage.removeItem(RECENT_SEARCHES_KEY)
    localStorage.removeItem(LEGACY_RECENT_SEARCHES_KEY)
  } catch (error) {
    console.error("Failed to clear recent searches:", error)
  }
}

export default RecentSearches
