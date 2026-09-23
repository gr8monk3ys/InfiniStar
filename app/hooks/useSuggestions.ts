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
function findLastAiMessageId(messages: FullMessageType[]): string | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].isAI) return messages[i].id
  }
  return null
}

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
  // The caller's `enabled` (preferences, dismissal) and the local toggle both
  // have to allow it. Derived, so a caller turning it off takes effect.
  const [isLocallyEnabled, setEnabled] = useState(true)
  const isEnabled = initialEnabled && isLocallyEnabled

  // Track last request to handle race conditions. A counter, not a
  // timestamp: two requests in the same millisecond must not share an id.
  const lastRequestRef = useRef<number>(0)
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null)
  const autoFetchTimerRef = useRef<NodeJS.Timeout | null>(null)

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

      const requestId = lastRequestRef.current + 1
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
        return new Promise((resolve, reject) => {
          debounceTimerRef.current = setTimeout(() => {
            // setTimeout wants a void callback; settle the outer promise from
            // the async work rather than letting it float.
            void fetchSuggestionsCore(type, partialInput).then(resolve, reject)
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
   * Remember the AI message already on screen at mount, so only a reply that
   * arrives later triggers suggestions (not the initial load). Declared before
   * the auto-fetch effect so it runs first in the same commit.
   */
  const hasInitializedRef = useRef(false)

  useEffect(() => {
    if (hasInitializedRef.current) return
    lastAiMessageIdRef.current = findLastAiMessageId(messages)
    hasInitializedRef.current = true
  }, [messages])

  /**
   * Auto-fetch reply suggestions when AI responds
   */
  useEffect(() => {
    if (!autoFetchOnAiResponse || !isEnabled || messages.length === 0) {
      return
    }

    const lastAiMessageId = findLastAiMessageId(messages)

    if (lastAiMessageId && lastAiMessageId !== lastAiMessageIdRef.current) {
      lastAiMessageIdRef.current = lastAiMessageId

      // Small delay to ensure the message is rendered. Kept in a ref rather
      // than cleared by this effect's cleanup: `messages` changes again while
      // a reply renders, and that must not cancel the fetch for it.
      if (autoFetchTimerRef.current) {
        clearTimeout(autoFetchTimerRef.current)
      }
      autoFetchTimerRef.current = setTimeout(() => {
        autoFetchTimerRef.current = null
        void fetchSuggestionsCore("reply")
      }, 100)
    }
  }, [messages, autoFetchOnAiResponse, isEnabled, fetchSuggestionsCore])

  /**
   * Cleanup on unmount
   */
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
      if (autoFetchTimerRef.current) {
        clearTimeout(autoFetchTimerRef.current)
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

interface SuggestionPreferences {
  enabled: boolean
  preferredTypes: SuggestionType[]
  maxSuggestions: number
  autoShow: boolean
}

const DEFAULT_SUGGESTION_PREFERENCES: SuggestionPreferences = {
  enabled: true,
  preferredTypes: ["reply", "question"],
  maxSuggestions: 4,
  autoShow: true,
}

// Versioned so a future shape change can migrate instead of mis-reading. The
// unversioned key is what earlier builds wrote; it is read once and moved.
const SUGGESTION_PREFERENCES_KEY = "infinistar-suggestion-preferences:v1"
const LEGACY_SUGGESTION_PREFERENCES_KEY = "infinistar-suggestion-preferences"
const SUGGESTION_TYPES = new Set<SuggestionType>(["continue", "reply", "question", "rephrase"])

/** Keep only known fields with the right types; anything else falls back to defaults. */
function parseSuggestionPreferences(raw: string): Partial<SuggestionPreferences> {
  const parsed: unknown = JSON.parse(raw)
  if (!parsed || typeof parsed !== "object") return {}
  const value = parsed as Record<string, unknown>
  const result: Partial<SuggestionPreferences> = {}
  if (typeof value.enabled === "boolean") result.enabled = value.enabled
  if (typeof value.autoShow === "boolean") result.autoShow = value.autoShow
  if (typeof value.maxSuggestions === "number") result.maxSuggestions = value.maxSuggestions
  if (Array.isArray(value.preferredTypes)) {
    result.preferredTypes = value.preferredTypes.filter((type): type is SuggestionType =>
      SUGGESTION_TYPES.has(type as SuggestionType)
    )
  }
  return result
}

function readStoredSuggestionPreferences(): Partial<SuggestionPreferences> {
  try {
    const stored = localStorage.getItem(SUGGESTION_PREFERENCES_KEY)
    if (stored) return parseSuggestionPreferences(stored)

    const legacy = localStorage.getItem(LEGACY_SUGGESTION_PREFERENCES_KEY)
    if (!legacy) return {}
    const migrated = parseSuggestionPreferences(legacy)
    localStorage.setItem(SUGGESTION_PREFERENCES_KEY, JSON.stringify(migrated))
    localStorage.removeItem(LEGACY_SUGGESTION_PREFERENCES_KEY)
    return migrated
  } catch {
    // Unavailable storage (private mode, quota) or bad JSON: use defaults.
    return {}
  }
}

function writeStoredSuggestionPreferences(preferences: SuggestionPreferences): void {
  try {
    localStorage.setItem(SUGGESTION_PREFERENCES_KEY, JSON.stringify(preferences))
  } catch {
    // Ignore storage errors
  }
}

/**
 * Hook for managing suggestion preferences in localStorage
 */
export function useSuggestionPreferences() {
  const [preferences, setPreferencesState] = useState<SuggestionPreferences>(
    DEFAULT_SUGGESTION_PREFERENCES
  )
  // The latest value, so the setter can merge and persist outside a state
  // updater (updaters must stay pure; React may call them twice).
  const preferencesRef = useRef(preferences)

  // Load preferences from localStorage after mount. Not a lazy initializer:
  // this hook also renders on the server, where storage does not exist, and
  // the first client render has to match that HTML.
  useEffect(() => {
    const stored = readStoredSuggestionPreferences()
    if (Object.keys(stored).length === 0) return
    const loaded = { ...preferencesRef.current, ...stored }
    preferencesRef.current = loaded
    setPreferencesState(loaded)
  }, [])

  // Save preferences to localStorage
  const setPreferences = useCallback((updates: Partial<SuggestionPreferences>) => {
    const updated = { ...preferencesRef.current, ...updates }
    preferencesRef.current = updated
    setPreferencesState(updated)
    writeStoredSuggestionPreferences(updated)
  }, [])

  return {
    preferences,
    setPreferences,
  }
}
