"use client"

import { useCallback, useEffect, useRef, useState } from "react"

import { useCsrfToken } from "@/app/hooks/useCsrfToken"
import { type FullMessageType } from "@/app/types"

/**
 * Suggestion types available
 */
export type SuggestionType = "continue" | "reply" | "question" | "rephrase"

/**
 * Individual suggestion
 */
export interface Suggestion {
  id: string
  text: string
  type: SuggestionType
}

/**
 * Suggestions API response
 */
interface SuggestionsApiResponse {
  suggestions: Suggestion[]
  type: SuggestionType
  cached: boolean
  error?: string
  code?: string
}

/**
 * Hook options
 */
interface UseSuggestionsOptions {
  /** Conversation ID */
  conversationId: string
  /** Recent messages for context */
  messages: FullMessageType[]
  /** Whether suggestions are enabled */
  enabled?: boolean
  /** Debounce delay in milliseconds (default: 500) */
  debounceMs?: number
  /** Auto-fetch reply suggestions after AI responds */
  autoFetchOnAiResponse?: boolean
  /** Callback when suggestions are fetched */
  onSuggestionsFetched?: (suggestions: Suggestion[]) => void
  /** Callback on error */
  onError?: (error: string) => void
}

/**
 * Hook return type
 */
interface UseSuggestionsReturn {
  /** Current suggestions */
  suggestions: Suggestion[]
  /** Whether suggestions are loading */
  isLoading: boolean
  /** Error message if any */
  error: string | null
  /** Current suggestion type */
  suggestionType: SuggestionType | null
  /** Whether result was from cache */
  isCached: boolean
  /** Fetch suggestions manually */
  fetchSuggestions: (type: SuggestionType, partialInput?: string) => Promise<void>
  /** Clear current suggestions */
  clearSuggestions: () => void
  /** Refresh suggestions (skip cache) */
  refreshSuggestions: () => Promise<void>
  /** Whether suggestions feature is enabled */
  isEnabled: boolean
  /** Toggle suggestions on/off */
  setEnabled: (enabled: boolean) => void
}

/**
 * Custom hook for managing AI suggestions
 *
 * @example
 * const {
 *   suggestions,
 *   isLoading,
 *   fetchSuggestions,
 *   clearSuggestions
 * } = useSuggestions({
 *   conversationId,
 *   messages,
 *   autoFetchOnAiResponse: true,
 * });
 *
 * // Fetch reply suggestions
 * await fetchSuggestions('reply');
 *
 * // Fetch continue suggestions with partial input
 * await fetchSuggestions('continue', 'What do you think about');
 */
export function useSuggestions(options: UseSuggestionsOptions): UseSuggestionsReturn {
  const {
    conversationId,
    messages,
    enabled: initialEnabled = true,
    debounceMs = 500,
    autoFetchOnAiResponse = true,
    onSuggestionsFetched,
    onError,
  } = options

  const { token: csrfToken } = useCsrfToken()

  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [suggestionType, setSuggestionType] = useState<SuggestionType | null>(null)
  const [isCached, setIsCached] = useState(false)
  const [isEnabled, setEnabled] = useState(initialEnabled)

  // Track last request to handle race conditions
  const lastRequestRef = useRef<number>(0)
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null)

  // Track the last AI message ID to detect new AI responses
  const lastAiMessageIdRef = useRef<string | null>(null)

  /**
   * Core fetch function
   */
  const fetchSuggestionsCore = useCallback(
    async (type: SuggestionType, partialInput?: string, skipCache = false): Promise<void> => {
      if (!csrfToken || !isEnabled) {
        return
      }

      const requestId = Date.now()
      lastRequestRef.current = requestId

      setIsLoading(true)
      setError(null)

      try {
        const response = await fetch("/api/ai/suggestions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-CSRF-Token": csrfToken,
          },
          body: JSON.stringify({
            conversationId,
            type,
            partialInput,
            skipCache,
          }),
        })

        // Check if this request is still the latest
        if (lastRequestRef.current !== requestId) {
          return // Newer request was made, discard this result
        }

        if (!response.ok) {
          const errorData: SuggestionsApiResponse = await response.json().catch(() => ({
            error: "Failed to fetch suggestions",
            suggestions: [],
            type,
            cached: false,
          }))
          throw new Error(errorData.error || `HTTP error! status: ${response.status}`)
        }

        const data: SuggestionsApiResponse = await response.json()

        // Update state
        setSuggestions(data.suggestions)
        setSuggestionType(data.type)
        setIsCached(data.cached)

        // Callback
        onSuggestionsFetched?.(data.suggestions)
      } catch (err) {
        // Check if this request is still the latest
        if (lastRequestRef.current !== requestId) {
          return
        }

        const errorMessage = err instanceof Error ? err.message : "Failed to fetch suggestions"
        setError(errorMessage)
        onError?.(errorMessage)
      } finally {
        // Check if this request is still the latest
        if (lastRequestRef.current === requestId) {
          setIsLoading(false)
        }
      }
    },
    [csrfToken, conversationId, isEnabled, onSuggestionsFetched, onError]
  )

  /**
   * Debounced fetch function (for typing scenarios)
   */
  const fetchSuggestions = useCallback(
    async (type: SuggestionType, partialInput?: string): Promise<void> => {
      // Clear existing debounce timer
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }

      // If no partial input or it's short, fetch immediately
      if (!partialInput || partialInput.length < 3) {
        await fetchSuggestionsCore(type, partialInput)
        return
      }

      // Debounce for continue/rephrase with partial input
      if (type === "continue" || type === "rephrase") {
        return new Promise((resolve) => {
          debounceTimerRef.current = setTimeout(async () => {
            await fetchSuggestionsCore(type, partialInput)
            resolve()
          }, debounceMs)
        })
      }

      // Immediate fetch for reply/question
      await fetchSuggestionsCore(type, partialInput)
    },
    [fetchSuggestionsCore, debounceMs]
  )

  /**
   * Clear suggestions
   */
  const clearSuggestions = useCallback(() => {
    setSuggestions([])
    setSuggestionType(null)
    setError(null)
    setIsCached(false)
  }, [])

  /**
   * Refresh suggestions (skip cache)
   */
  const refreshSuggestions = useCallback(async () => {
    if (suggestionType) {
      await fetchSuggestionsCore(suggestionType, undefined, true)
    }
  }, [suggestionType, fetchSuggestionsCore])

  /**
   * Auto-fetch reply suggestions when AI responds
   */
  useEffect(() => {
    if (!autoFetchOnAiResponse || !isEnabled || messages.length === 0) {
      return
    }

    // Find the last AI message
    const lastAiMessage = [...messages].reverse().find((m) => m.isAI)

    if (lastAiMessage && lastAiMessage.id !== lastAiMessageIdRef.current) {
      lastAiMessageIdRef.current = lastAiMessage.id

      // Only fetch if this is actually a new message (not initial load)
      if (lastAiMessageIdRef.current !== null) {
        // Small delay to ensure the message is rendered
        setTimeout(() => {
          fetchSuggestionsCore("reply")
        }, 100)
      }
    }
  }, [messages, autoFetchOnAiResponse, isEnabled, fetchSuggestionsCore])

  /**
   * Initialize last AI message ID on first render
   */
  const hasInitializedRef = useRef(false)

  useEffect(() => {
    if (hasInitializedRef.current) return
    const lastAiMessage = [...messages].reverse().find((m) => m.isAI)
    if (lastAiMessage) {
      lastAiMessageIdRef.current = lastAiMessage.id
    }
    hasInitializedRef.current = true
  }, [messages])

  /**
   * Cleanup on unmount
   */
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
    }
  }, [])

  return {
    suggestions,
    isLoading,
    error,
    suggestionType,
    isCached,
    fetchSuggestions,
    clearSuggestions,
    refreshSuggestions,
    isEnabled,
    setEnabled,
  }
}

/**
 * Hook for managing suggestion preferences in localStorage
 */
export function useSuggestionPreferences() {
  const STORAGE_KEY = "infinistar-suggestion-preferences"

  const [preferences, setPreferencesState] = useState<{
    enabled: boolean
    preferredTypes: SuggestionType[]
    maxSuggestions: number
    autoShow: boolean
  }>({
    enabled: true,
    preferredTypes: ["reply", "question"],
    maxSuggestions: 4,
    autoShow: true,
  })

  // Load preferences from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const parsed = JSON.parse(stored)
        setPreferencesState((prev) => ({ ...prev, ...parsed }))
      }
    } catch {
      // Ignore errors, use defaults
    }
  }, [])

  // Save preferences to localStorage
  const setPreferences = useCallback((updates: Partial<typeof preferences>) => {
    setPreferencesState((prev) => {
      const updated = { ...prev, ...updates }
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
      } catch {
        // Ignore storage errors
      }
      return updated
    })
  }, [])

  return {
    preferences,
    setPreferences,
  }
}
