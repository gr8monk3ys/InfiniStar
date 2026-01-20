"use client"

import { useCallback, useEffect, useMemo, useReducer, useRef } from "react"

import { api } from "@/app/lib/api-client"
import {
  DEFAULT_SEARCH_FILTERS,
  MIN_QUERY_LENGTH,
  type AdvancedSearchFilters,
  type AdvancedSearchResponse,
  type ConversationSearchResult,
  type MessageSearchResult,
  type SearchFacets,
  type SearchSuggestion,
  type SearchSuggestionsResponse,
} from "@/app/types/search"

import { useDebounce } from "../(dashboard)/dashboard/hooks/useDebounce"
import { saveRecentSearch } from "../components/search/RecentSearches"

/**
 * Search state interface
 */
interface SearchState {
  // Query and filters
  query: string
  filters: AdvancedSearchFilters

  // Results
  conversations: ConversationSearchResult[]
  messages: MessageSearchResult[]
  conversationCount: number
  messageCount: number
  totalPages: number
  hasMore: boolean
  searchTimeMs?: number

  // Facets
  facets?: SearchFacets

  // Suggestions
  suggestions: SearchSuggestion[]

  // UI state
  isSearching: boolean
  isSuggestionsLoading: boolean
  hasSearched: boolean
  error: string | null
  selectedIndex: number
  selectedSuggestionIndex: number
  showFilters: boolean
  showSuggestions: boolean
}

/**
 * Search actions
 */
type SearchAction =
  | { type: "SET_QUERY"; payload: string }
  | { type: "SET_FILTERS"; payload: Partial<AdvancedSearchFilters> }
  | { type: "RESET_FILTERS" }
  | { type: "SET_SEARCHING"; payload: boolean }
  | { type: "SET_SUGGESTIONS_LOADING"; payload: boolean }
  | { type: "SET_ERROR"; payload: string | null }
  | { type: "SET_SELECTED_INDEX"; payload: number }
  | { type: "SET_SUGGESTION_INDEX"; payload: number }
  | { type: "TOGGLE_FILTERS" }
  | { type: "SET_SHOW_SUGGESTIONS"; payload: boolean }
  | {
      type: "SET_RESULTS"
      payload: {
        conversations: ConversationSearchResult[]
        messages: MessageSearchResult[]
        conversationCount: number
        messageCount: number
        totalPages: number
        hasMore: boolean
        searchTimeMs?: number
        facets?: SearchFacets
      }
    }
  | { type: "SET_SUGGESTIONS"; payload: SearchSuggestion[] }
  | { type: "RESET" }

/**
 * Initial search state
 */
const initialState: SearchState = {
  query: "",
  filters: DEFAULT_SEARCH_FILTERS,
  conversations: [],
  messages: [],
  conversationCount: 0,
  messageCount: 0,
  totalPages: 0,
  hasMore: false,
  suggestions: [],
  isSearching: false,
  isSuggestionsLoading: false,
  hasSearched: false,
  error: null,
  selectedIndex: -1,
  selectedSuggestionIndex: -1,
  showFilters: false,
  showSuggestions: false,
}

/**
 * Search reducer
 */
function searchReducer(state: SearchState, action: SearchAction): SearchState {
  switch (action.type) {
    case "SET_QUERY":
      return {
        ...state,
        query: action.payload,
        filters: { ...state.filters, query: action.payload },
        selectedIndex: -1,
      }

    case "SET_FILTERS":
      return {
        ...state,
        filters: { ...state.filters, ...action.payload },
        selectedIndex: -1,
      }

    case "RESET_FILTERS":
      return {
        ...state,
        filters: { ...DEFAULT_SEARCH_FILTERS, query: state.query },
        selectedIndex: -1,
      }

    case "SET_SEARCHING":
      return { ...state, isSearching: action.payload }

    case "SET_SUGGESTIONS_LOADING":
      return { ...state, isSuggestionsLoading: action.payload }

    case "SET_ERROR":
      return { ...state, error: action.payload }

    case "SET_SELECTED_INDEX":
      return { ...state, selectedIndex: action.payload }

    case "SET_SUGGESTION_INDEX":
      return { ...state, selectedSuggestionIndex: action.payload }

    case "TOGGLE_FILTERS":
      return { ...state, showFilters: !state.showFilters }

    case "SET_SHOW_SUGGESTIONS":
      return { ...state, showSuggestions: action.payload }

    case "SET_RESULTS":
      return {
        ...state,
        ...action.payload,
        hasSearched: true,
        isSearching: false,
        error: null,
      }

    case "SET_SUGGESTIONS":
      return {
        ...state,
        suggestions: action.payload,
        isSuggestionsLoading: false,
        showSuggestions: action.payload.length > 0,
      }

    case "RESET":
      return initialState

    default:
      return state
  }
}

/**
 * useSearch Hook
 *
 * Provides comprehensive search functionality including:
 * - Debounced search queries
 * - Advanced filtering
 * - Auto-complete suggestions
 * - Keyboard navigation
 * - Recent search history
 */
export function useSearch() {
  const [state, dispatch] = useReducer(searchReducer, initialState)
  const abortControllerRef = useRef<AbortController | null>(null)
  const suggestionsAbortRef = useRef<AbortController | null>(null)

  // Debounce the query for search
  const debouncedQuery = useDebounce(state.query, 300)

  // Calculate visible results based on active tab
  const visibleConversations = useMemo(
    () => (state.filters.type === "messages" ? [] : state.conversations),
    [state.filters.type, state.conversations]
  )

  const visibleMessages = useMemo(
    () => (state.filters.type === "conversations" ? [] : state.messages),
    [state.filters.type, state.messages]
  )

  const totalVisible = visibleConversations.length + visibleMessages.length

  // Perform search
  const performSearch = useCallback(async () => {
    if (!debouncedQuery || debouncedQuery.length < MIN_QUERY_LENGTH) {
      dispatch({
        type: "SET_RESULTS",
        payload: {
          conversations: [],
          messages: [],
          conversationCount: 0,
          messageCount: 0,
          totalPages: 0,
          hasMore: false,
        },
      })
      return
    }

    // Cancel any pending request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    abortControllerRef.current = new AbortController()

    dispatch({ type: "SET_SEARCHING", payload: true })
    dispatch({ type: "SET_ERROR", payload: null })
    dispatch({ type: "SET_SHOW_SUGGESTIONS", payload: false })

    try {
      const params = new URLSearchParams({
        query: debouncedQuery,
        type: state.filters.type,
        sortBy: state.filters.sortBy,
        page: String(state.filters.page),
        limit: String(state.filters.limit),
        includeFacets: "true",
      })

      if (state.filters.dateFrom) {
        params.append("dateFrom", state.filters.dateFrom)
      }
      if (state.filters.dateTo) {
        params.append("dateTo", state.filters.dateTo)
      }
      if (state.filters.isAI !== undefined) {
        params.append("isAI", String(state.filters.isAI))
      }
      if (state.filters.personality) {
        params.append("personality", state.filters.personality)
      }
      if (state.filters.tagIds && state.filters.tagIds.length > 0) {
        params.append("tagIds", state.filters.tagIds.join(","))
      }
      if (state.filters.hasAttachments) {
        params.append("hasAttachments", "true")
      }
      if (state.filters.archived) {
        params.append("archived", "true")
      }

      const response = await api.get<AdvancedSearchResponse>(`/api/search?${params.toString()}`, {
        showErrorToast: false,
      })

      if (response.success && response.data) {
        dispatch({
          type: "SET_RESULTS",
          payload: {
            conversations: response.data.conversations,
            messages: response.data.messages,
            conversationCount: response.data.conversationCount,
            messageCount: response.data.messageCount,
            totalPages: response.data.totalPages,
            hasMore: response.data.hasMore,
            searchTimeMs: response.data.searchTimeMs,
            facets: response.facets,
          },
        })

        // Save to recent searches
        const totalResults = response.data.conversationCount + response.data.messageCount
        if (totalResults > 0) {
          saveRecentSearch(debouncedQuery, totalResults)
        }
      } else {
        dispatch({ type: "SET_ERROR", payload: response.error || "Search failed" })
        dispatch({ type: "SET_SEARCHING", payload: false })
      }
    } catch (error) {
      if ((error as Error).name !== "AbortError") {
        dispatch({
          type: "SET_ERROR",
          payload: "Failed to search. Please try again.",
        })
        dispatch({ type: "SET_SEARCHING", payload: false })
      }
    }
  }, [debouncedQuery, state.filters])

  // Fetch suggestions
  const fetchSuggestions = useCallback(async () => {
    if (!state.query || state.query.length < MIN_QUERY_LENGTH) {
      dispatch({ type: "SET_SUGGESTIONS", payload: [] })
      return
    }

    // Cancel any pending request
    if (suggestionsAbortRef.current) {
      suggestionsAbortRef.current.abort()
    }
    suggestionsAbortRef.current = new AbortController()

    dispatch({ type: "SET_SUGGESTIONS_LOADING", payload: true })

    try {
      const response = await api.post<SearchSuggestionsResponse>(
        "/api/search",
        { query: state.query, limit: 5 },
        { showErrorToast: false }
      )

      if (response.success && response.suggestions) {
        dispatch({ type: "SET_SUGGESTIONS", payload: response.suggestions })
      } else {
        dispatch({ type: "SET_SUGGESTIONS", payload: [] })
      }
    } catch (error) {
      if ((error as Error).name !== "AbortError") {
        dispatch({ type: "SET_SUGGESTIONS", payload: [] })
      }
    }
  }, [state.query])

  // Trigger search when debounced query or filters change
  useEffect(() => {
    performSearch()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    debouncedQuery,
    state.filters.type,
    state.filters.dateFrom,
    state.filters.dateTo,
    state.filters.isAI,
    state.filters.personality,
    state.filters.tagIds,
    state.filters.hasAttachments,
    state.filters.archived,
    state.filters.sortBy,
    state.filters.page,
  ])

  // Fetch suggestions when query changes (faster than debounced)
  useEffect(() => {
    const timer = setTimeout(() => {
      if (state.query.length >= MIN_QUERY_LENGTH && !state.hasSearched) {
        fetchSuggestions()
      }
    }, 150)

    return () => clearTimeout(timer)
  }, [state.query, state.hasSearched, fetchSuggestions])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort()
      suggestionsAbortRef.current?.abort()
    }
  }, [])

  // Action creators
  const setQuery = useCallback((query: string) => {
    dispatch({ type: "SET_QUERY", payload: query })
  }, [])

  const setFilters = useCallback((filters: Partial<AdvancedSearchFilters>) => {
    dispatch({ type: "SET_FILTERS", payload: filters })
  }, [])

  const resetFilters = useCallback(() => {
    dispatch({ type: "RESET_FILTERS" })
  }, [])

  const setSelectedIndex = useCallback((index: number) => {
    dispatch({ type: "SET_SELECTED_INDEX", payload: index })
  }, [])

  const setSuggestionIndex = useCallback((index: number) => {
    dispatch({ type: "SET_SUGGESTION_INDEX", payload: index })
  }, [])

  const toggleFilters = useCallback(() => {
    dispatch({ type: "TOGGLE_FILTERS" })
  }, [])

  const hideSuggestions = useCallback(() => {
    dispatch({ type: "SET_SHOW_SUGGESTIONS", payload: false })
  }, [])

  const reset = useCallback(() => {
    dispatch({ type: "RESET" })
  }, [])

  // Navigate results with keyboard
  const navigateUp = useCallback(() => {
    if (state.showSuggestions && state.suggestions.length > 0) {
      const newIndex =
        state.selectedSuggestionIndex > 0
          ? state.selectedSuggestionIndex - 1
          : state.suggestions.length - 1
      dispatch({ type: "SET_SUGGESTION_INDEX", payload: newIndex })
    } else if (totalVisible > 0) {
      const newIndex = state.selectedIndex > 0 ? state.selectedIndex - 1 : totalVisible - 1
      dispatch({ type: "SET_SELECTED_INDEX", payload: newIndex })
    }
  }, [
    state.showSuggestions,
    state.suggestions.length,
    state.selectedSuggestionIndex,
    state.selectedIndex,
    totalVisible,
  ])

  const navigateDown = useCallback(() => {
    if (state.showSuggestions && state.suggestions.length > 0) {
      const newIndex =
        state.selectedSuggestionIndex < state.suggestions.length - 1
          ? state.selectedSuggestionIndex + 1
          : 0
      dispatch({ type: "SET_SUGGESTION_INDEX", payload: newIndex })
    } else if (totalVisible > 0) {
      const newIndex = state.selectedIndex < totalVisible - 1 ? state.selectedIndex + 1 : 0
      dispatch({ type: "SET_SELECTED_INDEX", payload: newIndex })
    }
  }, [
    state.showSuggestions,
    state.suggestions.length,
    state.selectedSuggestionIndex,
    state.selectedIndex,
    totalVisible,
  ])

  // Get selected item info
  const getSelectedItem = useCallback(() => {
    if (state.showSuggestions && state.selectedSuggestionIndex >= 0) {
      return {
        type: "suggestion" as const,
        item: state.suggestions[state.selectedSuggestionIndex],
      }
    }

    if (state.selectedIndex >= 0) {
      if (state.selectedIndex < visibleConversations.length) {
        return {
          type: "conversation" as const,
          item: visibleConversations[state.selectedIndex],
        }
      } else {
        const messageIndex = state.selectedIndex - visibleConversations.length
        return {
          type: "message" as const,
          item: visibleMessages[messageIndex],
        }
      }
    }

    return null
  }, [
    state.showSuggestions,
    state.selectedSuggestionIndex,
    state.selectedIndex,
    state.suggestions,
    visibleConversations,
    visibleMessages,
  ])

  // Go to next page
  const nextPage = useCallback(() => {
    if (state.hasMore) {
      dispatch({
        type: "SET_FILTERS",
        payload: { page: state.filters.page + 1 },
      })
    }
  }, [state.hasMore, state.filters.page])

  // Go to previous page
  const prevPage = useCallback(() => {
    if (state.filters.page > 1) {
      dispatch({
        type: "SET_FILTERS",
        payload: { page: state.filters.page - 1 },
      })
    }
  }, [state.filters.page])

  return {
    // State
    ...state,
    visibleConversations,
    visibleMessages,
    totalVisible,
    debouncedQuery,

    // Actions
    setQuery,
    setFilters,
    resetFilters,
    setSelectedIndex,
    setSuggestionIndex,
    toggleFilters,
    hideSuggestions,
    reset,
    navigateUp,
    navigateDown,
    getSelectedItem,
    nextPage,
    prevPage,
    performSearch,
  }
}

export default useSearch
