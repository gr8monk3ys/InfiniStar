"use client"

import { useLatestTokenUsage } from "@/app/hooks/useTokenUsage"

import { TokenUsageDisplay } from "./TokenUsageDisplay"

interface TokenUsageWrapperProps {
  conversationId: string
}

/**
 * Wrapper component that provides the latest token usage from the Zustand store
 * to the TokenUsageDisplay component.
 *
 * This allows the expandable panel version to receive real-time updates
 * from the streaming AI response.
 */
export function TokenUsageWrapper({ conversationId }: TokenUsageWrapperProps) {
  const latestMessageUsage = useLatestTokenUsage(conversationId)

  return (
    <TokenUsageDisplay
      conversationId={conversationId}
      isAIConversation={true}
      latestMessageUsage={latestMessageUsage}
    />
  )
}
