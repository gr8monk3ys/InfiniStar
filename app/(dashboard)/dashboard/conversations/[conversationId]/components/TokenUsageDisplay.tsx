"use client"

import * as React from "react"
import { memo, useState } from "react"
import { HiChevronDown, HiChevronUp, HiInformationCircle } from "react-icons/hi2"

import { cn } from "@/app/lib/utils"
import { Popover, PopoverContent, PopoverTrigger } from "@/app/components/ui/popover"
import {
  formatCost,
  formatTokenCount,
  useTokenUsage,
  type ConversationTokenStats,
  type SubscriptionUsage,
  type TokenUsage,
  type UsageStats,
} from "@/app/hooks/useTokenUsage"

/**
 * Progress bar component for visual usage indication
 */
function ProgressBar({
  value,
  max,
  label,
  color = "sky",
  showPercentage = true,
}: {
  value: number
  max: number
  label: string
  color?: "sky" | "green" | "yellow" | "red"
  showPercentage?: boolean
}) {
  const percentage = max > 0 ? Math.min((value / max) * 100, 100) : 0
  const colorClasses = {
    sky: "bg-sky-500",
    green: "bg-green-500",
    yellow: "bg-yellow-500",
    red: "bg-red-500",
  }

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{label}</span>
        {showPercentage && <span>{percentage.toFixed(1)}%</span>}
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={cn("h-full transition-all duration-300", colorClasses[color])}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  )
}

/**
 * Get color based on context usage percentage
 */
function getContextUsageColor(percentage: number): "sky" | "green" | "yellow" | "red" {
  if (percentage < 50) return "green"
  if (percentage < 75) return "yellow"
  return "red"
}

/**
 * Get color based on message limit usage
 */
function getMessageLimitColor(
  used: number,
  limit: number | null
): "sky" | "green" | "yellow" | "red" {
  if (limit === null) return "green" // Pro users
  const percentage = (used / limit) * 100
  if (percentage < 50) return "green"
  if (percentage < 80) return "yellow"
  return "red"
}

function getQuotaColor(used: number, limit: number | null): "sky" | "green" | "yellow" | "red" {
  if (limit === null || limit <= 0) return "green"
  const percentage = (used / limit) * 100
  if (percentage < 50) return "green"
  if (percentage < 80) return "yellow"
  return "red"
}

/**
 * Detailed usage breakdown section
 */
function UsageBreakdownSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg bg-muted/50 p-3">
      <h4 className="mb-2 text-xs font-semibold uppercase text-muted-foreground">{title}</h4>
      {children}
    </div>
  )
}

/**
 * Token counts display grid
 */
function TokenCountsGrid({
  inputTokens,
  outputTokens,
  totalTokens,
}: {
  inputTokens: number
  outputTokens: number
  totalTokens: number
}) {
  return (
    <div className="grid grid-cols-3 gap-2 text-center">
      <div>
        <div className="text-lg font-semibold text-sky-600 dark:text-sky-400">
          {formatTokenCount(inputTokens)}
        </div>
        <div className="text-xs text-muted-foreground">Input</div>
      </div>
      <div>
        <div className="text-lg font-semibold text-green-600 dark:text-green-400">
          {formatTokenCount(outputTokens)}
        </div>
        <div className="text-xs text-muted-foreground">Output</div>
      </div>
      <div>
        <div className="text-lg font-semibold text-foreground">{formatTokenCount(totalTokens)}</div>
        <div className="text-xs text-muted-foreground">Total</div>
      </div>
    </div>
  )
}

/**
 * Latest message usage section
 */
function LatestMessageSection({ usage }: { usage: TokenUsage }) {
  return (
    <UsageBreakdownSection title="Latest Message">
      <TokenCountsGrid
        inputTokens={usage.inputTokens}
        outputTokens={usage.outputTokens}
        totalTokens={usage.totalTokens}
      />
    </UsageBreakdownSection>
  )
}

/**
 * Conversation total tokens section
 */
function ConversationTotalSection({ tokens }: { tokens: ConversationTokenStats }) {
  return (
    <UsageBreakdownSection title="Conversation Total">
      <TokenCountsGrid
        inputTokens={tokens.totalInputTokens}
        outputTokens={tokens.totalOutputTokens}
        totalTokens={tokens.totalTokens}
      />
      <div className="mt-3">
        <ProgressBar
          value={tokens.currentContextTokens}
          max={tokens.contextWindowSize}
          label={`Context Window (${formatTokenCount(
            tokens.currentContextTokens
          )} / ${formatTokenCount(tokens.contextWindowSize)})`}
          color={getContextUsageColor(tokens.contextUsagePercentage)}
        />
      </div>
    </UsageBreakdownSection>
  )
}

/**
 * Subscription usage section
 */
function SubscriptionSection({ subscription }: { subscription: SubscriptionUsage }) {
  const hasCostCap = subscription.isPro && subscription.monthlyCostQuotaCents !== null

  return (
    <UsageBreakdownSection title={`Monthly Usage (${subscription.plan})`}>
      {subscription.isPro ? (
        hasCostCap ? (
          <>
            <div className="mb-2 grid grid-cols-2 gap-2 text-center">
              <div>
                <div className="text-lg font-semibold text-foreground">
                  {formatCost(subscription.monthlyCostUsageCents)}
                </div>
                <div className="text-xs text-muted-foreground">Used</div>
              </div>
              <div>
                <div className="text-lg font-semibold text-foreground">
                  {formatCost(subscription.monthlyCostQuotaCents!)}
                </div>
                <div className="text-xs text-muted-foreground">Fair-Use Cap</div>
              </div>
            </div>
            <ProgressBar
              value={subscription.monthlyCostUsageCents}
              max={subscription.monthlyCostQuotaCents!}
              label={`Spend (${formatCost(subscription.monthlyCostUsageCents)} / ${formatCost(
                subscription.monthlyCostQuotaCents!
              )})`}
              color={getQuotaColor(
                subscription.monthlyCostUsageCents,
                subscription.monthlyCostQuotaCents
              )}
            />
            <div className="mt-2 text-center text-xs text-muted-foreground">
              {subscription.monthlyMessageCount} messages this month
            </div>
          </>
        ) : (
          <div className="text-center">
            <div className="text-lg font-semibold text-green-600 dark:text-green-400">
              Unlimited
            </div>
            <div className="text-xs text-muted-foreground">
              {subscription.monthlyMessageCount} messages this month
            </div>
          </div>
        )
      ) : (
        <>
          <div className="mb-2 grid grid-cols-2 gap-2 text-center">
            <div>
              <div className="text-lg font-semibold text-foreground">
                {subscription.monthlyMessageCount}
              </div>
              <div className="text-xs text-muted-foreground">Used</div>
            </div>
            <div>
              <div
                className={cn(
                  "text-lg font-semibold",
                  subscription.remainingMessages === 0
                    ? "text-red-600 dark:text-red-400"
                    : "text-green-600 dark:text-green-400"
                )}
              >
                {subscription.remainingMessages}
              </div>
              <div className="text-xs text-muted-foreground">Remaining</div>
            </div>
          </div>
          <ProgressBar
            value={subscription.monthlyMessageCount}
            max={subscription.monthlyMessageLimit || 10}
            label={`Messages (${subscription.monthlyMessageCount} / ${subscription.monthlyMessageLimit})`}
            color={getMessageLimitColor(
              subscription.monthlyMessageCount,
              subscription.monthlyMessageLimit
            )}
          />
          {subscription.monthlyTokenQuota ? (
            <div className="mt-3">
              <ProgressBar
                value={subscription.monthlyTokenUsage}
                max={subscription.monthlyTokenQuota}
                label={`Tokens (${formatTokenCount(
                  subscription.monthlyTokenUsage
                )} / ${formatTokenCount(subscription.monthlyTokenQuota)})`}
                color={getQuotaColor(
                  subscription.monthlyTokenUsage,
                  subscription.monthlyTokenQuota
                )}
              />
            </div>
          ) : null}
        </>
      )}
    </UsageBreakdownSection>
  )
}

/**
 * Overall statistics section
 */
function OverallStatsSection({ stats }: { stats: UsageStats }) {
  return (
    <UsageBreakdownSection title="Overall Statistics (This Month)">
      <div className="grid grid-cols-2 gap-2 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Total Requests:</span>
          <span className="font-medium">{stats.totalRequests}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Total Tokens:</span>
          <span className="font-medium">{formatTokenCount(stats.totalTokens)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Avg Latency:</span>
          <span className="font-medium">{stats.averageLatency}ms</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Est. Cost:</span>
          <span className="font-medium">{formatCost(stats.totalCost)}</span>
        </div>
      </div>
    </UsageBreakdownSection>
  )
}

interface TokenUsageCompactProps {
  conversationId: string
  isAIConversation: boolean
}

/**
 * Compact token usage display for the header
 * Shows a small badge with token count that opens a detailed popover on click
 */
export const TokenUsageCompact = memo(function TokenUsageCompact({
  conversationId,
  isAIConversation,
}: TokenUsageCompactProps) {
  const { data, isLoading, error, latestMessageUsage } = useTokenUsage(conversationId, {
    enabled: isAIConversation,
  })

  if (!isAIConversation) {
    return null
  }

  // Get the display values
  const conversationTokens = data?.conversationTokens?.totalTokens ?? 0
  const contextPercentage = data?.conversationTokens?.contextUsagePercentage ?? 0
  const hasData = data && data.conversationTokens

  // Determine badge color based on context usage
  const getBadgeColor = () => {
    if (!hasData) return "bg-muted text-muted-foreground"
    if (contextPercentage < 50)
      return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
    if (contextPercentage < 75)
      return "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
    return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className={cn(
            "flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-colors",
            "hover:ring-2 hover:ring-ring hover:ring-offset-2",
            "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
            getBadgeColor()
          )}
          aria-label="View token usage details"
          title="Token usage"
        >
          {isLoading ? (
            <span className="animate-pulse">...</span>
          ) : error ? (
            <span className="text-red-500">Error</span>
          ) : (
            <>
              <HiInformationCircle className="size-3.5" aria-hidden="true" />
              <span>{formatTokenCount(conversationTokens)} tokens</span>
              {latestMessageUsage && (
                <span className="text-[10px] opacity-70">
                  (+{formatTokenCount(latestMessageUsage.totalTokens)})
                </span>
              )}
            </>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end" sideOffset={8}>
        <div className="p-4">
          <h3 className="mb-3 font-semibold text-foreground">Token Usage</h3>

          {isLoading && (
            <div className="py-4 text-center text-sm text-muted-foreground">
              Loading usage data...
            </div>
          )}

          {error && <div className="py-4 text-center text-sm text-red-500">{error}</div>}

          {data && !isLoading && (
            <div className="space-y-3">
              {latestMessageUsage && <LatestMessageSection usage={latestMessageUsage} />}
              {data.conversationTokens && (
                <ConversationTotalSection tokens={data.conversationTokens} />
              )}
              {data.subscription && <SubscriptionSection subscription={data.subscription} />}
              {data.stats && <OverallStatsSection stats={data.stats} />}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
})

interface TokenUsageDisplayProps {
  conversationId: string
  isAIConversation: boolean
  latestMessageUsage?: TokenUsage | null
}

/**
 * Full token usage display panel (expandable)
 * Shows token usage in an expandable panel below the header
 */
export const TokenUsageDisplay = memo(function TokenUsageDisplay({
  conversationId,
  isAIConversation,
  latestMessageUsage: externalLatestUsage,
}: TokenUsageDisplayProps) {
  const {
    data,
    isLoading,
    error,
    latestMessageUsage: hookLatestUsage,
  } = useTokenUsage(conversationId, { enabled: isAIConversation })

  // Use externally provided usage or fall back to hook's usage
  const latestMessageUsage = externalLatestUsage ?? hookLatestUsage

  const [isExpanded, setIsExpanded] = useState(false)

  if (!isAIConversation) {
    return null
  }

  return (
    <div className="border-b border-border bg-muted/30 px-4 py-2">
      {/* Collapsed view */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex w-full items-center justify-between text-sm text-muted-foreground hover:text-foreground"
        aria-expanded={isExpanded}
        aria-label="Toggle token usage details"
      >
        <div className="flex items-center gap-2">
          <HiInformationCircle className="size-4" aria-hidden="true" />
          <span className="font-medium">Token Usage</span>
          {latestMessageUsage && (
            <span className="rounded-full bg-sky-100 px-2 py-0.5 text-xs text-sky-700 dark:bg-sky-900/30 dark:text-sky-400">
              Last: {formatTokenCount(latestMessageUsage.totalTokens)} tokens
            </span>
          )}
          {data?.conversationTokens && (
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
              Context: {data.conversationTokens.contextUsagePercentage.toFixed(1)}%
            </span>
          )}
        </div>
        {isExpanded ? (
          <HiChevronUp className="size-4" aria-hidden="true" />
        ) : (
          <HiChevronDown className="size-4" aria-hidden="true" />
        )}
      </button>

      {/* Expanded view */}
      {isExpanded && (
        <div className="mt-3 space-y-3">
          {isLoading && (
            <div className="py-4 text-center text-sm text-muted-foreground">
              Loading usage data...
            </div>
          )}

          {error && <div className="py-4 text-center text-sm text-red-500">{error}</div>}

          {data && !isLoading && (
            <>
              {latestMessageUsage && <LatestMessageSection usage={latestMessageUsage} />}
              {data.conversationTokens && (
                <ConversationTotalSection tokens={data.conversationTokens} />
              )}
              {data.subscription && <SubscriptionSection subscription={data.subscription} />}
              {data.stats && <OverallStatsSection stats={data.stats} />}
            </>
          )}
        </div>
      )}
    </div>
  )
})
