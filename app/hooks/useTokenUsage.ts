"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { create } from "zustand"

/**
 * Token usage data for a single message
 */
export interface TokenUsage {
  inputTokens: number
  outputTokens: number
  totalTokens: number
}

/**
 * Conversation-specific token statistics
 */
export interface ConversationTokenStats {
  totalInputTokens: number
  totalOutputTokens: number
  totalTokens: number
  currentContextTokens: number
  contextWindowSize: number
  contextUsagePercentage: number
}

/**
 * User subscription and usage limits
 */
export interface SubscriptionUsage {
  isPro: boolean
  plan: string
  monthlyMessageCount: number
  monthlyMessageLimit: number | null
  remainingMessages: number | null
}

/**
 * Overall usage statistics
 */
export interface UsageStats {
  totalRequests: number
  totalInputTokens: number
  totalOutputTokens: number
  totalTokens: number
  totalCost: number
  totalInputCost: number
  totalOutputCost: number
  averageLatency: number
}

/**
 * Complete token usage response from the API
 */
export interface TokenUsageData {
  stats: UsageStats
  subscription: SubscriptionUsage
  conversationTokens: ConversationTokenStats | null
}

interface TokenUsageState {
  latestUsage: TokenUsage | null
  conversationId: string | null
  setLatestUsage: (usage: TokenUsage, conversationId: string) => void
  clearUsage: () => void
}

/**
 * Zustand store for sharing token usage data between components
 *
 * Used to communicate token usage from the Form component (which receives
 * the SSE stream data) to the TokenUsageDisplay component.
 */
export const useTokenUsageStore = create<TokenUsageState>((set) => ({
  latestUsage: null,
  conversationId: null,
  setLatestUsage: (usage, conversationId) => set({ latestUsage: usage, conversationId }),
  clearUsage: () => set({ latestUsage: null, conversationId: null }),
}))

/**
 * Hook to get the latest token usage for a specific conversation
 */
export function useLatestTokenUsage(conversationId: string): TokenUsage | null {
  const { latestUsage, conversationId: storeConversationId } = useTokenUsageStore()

  // Only return usage if it's for the current conversation
  if (storeConversationId === conversationId) {
    return latestUsage
  }

  return null
}

/**
 * Hook to fetch and manage token usage data for a conversation
 *
 * @param conversationId - The ID of the conversation to fetch usage for
 * @param options - Optional configuration
 * @returns Object with usage data, loading state, error, and refetch function
 *
 * @example
 * const { data, isLoading, error, refetch } = useTokenUsage(conversationId, {
 *   enabled: isAIConversation,
 *   period: 'month',
 * });
 */
export function useTokenUsage(
  conversationId: string,
  options?: {
    enabled?: boolean
    period?: "day" | "week" | "month" | "all"
    refetchOnLatestUsage?: boolean
  }
) {
  const { enabled = true, period = "month", refetchOnLatestUsage = true } = options || {}

  const [data, setData] = useState<TokenUsageData | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Track active AbortController to prevent memory leaks
  const abortControllerRef = useRef<AbortController | null>(null)

  // Get the latest usage from the store for auto-refresh
  const latestUsage = useLatestTokenUsage(conversationId)

  const fetchUsage = useCallback(
    async (signal?: AbortSignal) => {
      if (!enabled || !conversationId) return

      setIsLoading(true)
      setError(null)

      try {
        const response = await fetch(
          `/api/ai/usage?conversationId=${conversationId}&period=${period}`,
          { signal }
        )

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          throw new Error(errorData.error || `HTTP error! status: ${response.status}`)
        }

        const responseData = await response.json()
        setData({
          stats: responseData.stats,
          subscription: responseData.subscription,
          conversationTokens: responseData.conversationTokens,
        })
      } catch (err) {
        // Ignore abort errors
        if (err instanceof Error && err.name === "AbortError") {
          return
        }
        const message = err instanceof Error ? err.message : "Failed to fetch token usage"
        setError(message)
      } finally {
        setIsLoading(false)
      }
    },
    [conversationId, enabled, period]
  )

  // Fetch on mount and when dependencies change
  useEffect(() => {
    if (!enabled) return

    // Cancel any pending request
    abortControllerRef.current?.abort()

    // Create new AbortController for this request
    const abortController = new AbortController()
    abortControllerRef.current = abortController

    fetchUsage(abortController.signal)

    // Cleanup: abort on unmount or dependency change
    return () => {
      abortController.abort()
    }
  }, [enabled, fetchUsage])

  // Refetch when new usage data is received from streaming
  useEffect(() => {
    if (!refetchOnLatestUsage || !latestUsage || !enabled) return

    // Cancel any pending request
    abortControllerRef.current?.abort()

    const abortController = new AbortController()
    abortControllerRef.current = abortController

    fetchUsage(abortController.signal)

    return () => {
      abortController.abort()
    }
  }, [latestUsage, refetchOnLatestUsage, enabled, fetchUsage])

  // Manual refetch function
  const refetch = useCallback(() => {
    abortControllerRef.current?.abort()
    const abortController = new AbortController()
    abortControllerRef.current = abortController
    return fetchUsage(abortController.signal)
  }, [fetchUsage])

  return {
    data,
    isLoading,
    error,
    refetch,
    latestMessageUsage: latestUsage,
  }
}

/**
 * Format a number for display (e.g., 1234 -> "1.2K", 1234567 -> "1.2M")
 */
export function formatTokenCount(num: number): string {
  if (num >= 1_000_000) {
    return `${(num / 1_000_000).toFixed(1)}M`
  }
  if (num >= 1_000) {
    return `${(num / 1_000).toFixed(1)}K`
  }
  return num.toString()
}

/**
 * Format cost in cents to a readable dollar amount
 */
export function formatCost(cents: number): string {
  const dollars = cents / 100
  if (dollars < 0.01) {
    return "<$0.01"
  }
  return `$${dollars.toFixed(4)}`
}
