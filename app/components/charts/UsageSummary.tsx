"use client"

import {
  HiOutlineChartBar,
  HiOutlineChatBubbleLeftRight,
  HiOutlineCircleStack,
  HiOutlineClock,
  HiOutlineCurrencyDollar,
  HiOutlineSparkles,
} from "react-icons/hi2"

import { cn } from "@/app/lib/utils"

import { UsageCard } from "./UsageCard"

interface UsageStats {
  totalRequests: number
  totalInputTokens: number
  totalOutputTokens: number
  totalTokens: number
  totalCost: number
  totalInputCost: number
  totalOutputCost: number
  averageLatency: number
}

interface SubscriptionInfo {
  isPro: boolean
  plan: string
  monthlyMessageCount: number
  monthlyMessageLimit: number | null
  remainingMessages: number | null
  monthlyTokenUsage: number
  monthlyTokenQuota: number | null
  monthlyCostUsageCents: number
  monthlyCostQuotaCents: number | null
}

interface UsageSummaryProps {
  stats: UsageStats
  subscription: SubscriptionInfo
  avgMessagesPerConversation?: number
  className?: string
  loading?: boolean
}

/**
 * Format cost in dollars from cents
 */
function formatCost(cents: number): string {
  const dollars = cents / 100
  if (dollars < 0.01) return "<$0.01"
  return `$${dollars.toFixed(4)}`
}

/**
 * Format number with K/M suffix for large numbers
 */
function formatCompactNumber(num: number): string {
  if (num >= 1_000_000) {
    return `${(num / 1_000_000).toFixed(1)}M`
  }
  if (num >= 1_000) {
    return `${(num / 1_000).toFixed(1)}K`
  }
  return num.toLocaleString()
}

/**
 * Format latency display
 */
function formatLatency(ms: number): string {
  if (ms >= 1000) {
    return `${(ms / 1000).toFixed(1)}s`
  }
  return `${ms}ms`
}

/**
 * Get latency quality label
 */
function getLatencyLabel(ms: number): string {
  if (ms < 2000) return "Fast"
  if (ms < 5000) return "Normal"
  return "Slow"
}

/**
 * Summary section showing key usage metrics
 */
export function UsageSummary({
  stats,
  subscription,
  avgMessagesPerConversation = 0,
  className,
  loading = false,
}: UsageSummaryProps) {
  // Calculate messages remaining for display
  const messagesDisplay = subscription.isPro
    ? `${subscription.monthlyMessageCount} this month`
    : `${subscription.remainingMessages ?? 0} remaining`

  const hasCostCap = subscription.isPro && subscription.monthlyCostQuotaCents !== null
  const quotaTitle = hasCostCap ? "Monthly AI Fair-Use Cap" : "Monthly Token Quota"
  const quotaUsed = hasCostCap ? subscription.monthlyCostUsageCents : subscription.monthlyTokenUsage
  const quotaTotal = hasCostCap
    ? subscription.monthlyCostQuotaCents
    : subscription.monthlyTokenQuota
  const quotaPercentage =
    quotaTotal && quotaTotal > 0 ? Math.min(Math.round((quotaUsed / quotaTotal) * 100), 100) : 0
  const quotaRemaining = quotaTotal ? Math.max(0, quotaTotal - quotaUsed) : 0

  return (
    <div className={cn("space-y-6", className)}>
      {/* Quota Progress Bar */}
      <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-medium text-card-foreground">{quotaTitle}</h3>
          {quotaTotal ? (
            <span className="text-sm text-muted-foreground">
              {hasCostCap ? (
                <>
                  {formatCost(quotaUsed)} / {formatCost(quotaTotal)}
                </>
              ) : (
                <>
                  {formatCompactNumber(quotaUsed)} / {formatCompactNumber(quotaTotal)} tokens
                </>
              )}
            </span>
          ) : (
            <span className="text-sm text-muted-foreground">
              {hasCostCap ? formatCost(quotaUsed) : `${formatCompactNumber(quotaUsed)} tokens`}
            </span>
          )}
        </div>
        <div
          className="h-3 w-full overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-valuenow={quotaPercentage}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`${quotaTitle} usage: ${quotaPercentage}%`}
        >
          <div
            className={cn(
              "h-full transition-all duration-500",
              quotaPercentage > 90
                ? "bg-red-500"
                : quotaPercentage > 70
                  ? "bg-yellow-500"
                  : "bg-gradient-to-r from-purple-500 to-pink-500"
            )}
            style={{ width: `${quotaPercentage}%` }}
          />
        </div>
        <div className="mt-2 flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            {quotaTotal ? (
              hasCostCap ? (
                <>
                  {formatCost(quotaRemaining)} remaining ({(100 - quotaPercentage).toFixed(1)}%)
                </>
              ) : (
                <>
                  {formatCompactNumber(quotaRemaining)} tokens remaining (
                  {(100 - quotaPercentage).toFixed(1)}%)
                </>
              )
            ) : (
              <>{subscription.isPro ? "No quota configured" : "No quota configured"}</>
            )}
          </p>
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-xs font-medium",
              subscription.isPro
                ? "bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300"
                : "bg-muted text-muted-foreground"
            )}
          >
            {subscription.plan}
          </span>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <UsageCard
          title="Total Messages"
          value={stats.totalRequests}
          subtitle={messagesDisplay}
          icon={<HiOutlineChatBubbleLeftRight className="size-5" />}
          loading={loading}
        />

        <UsageCard
          title="Total Tokens"
          value={formatCompactNumber(stats.totalTokens)}
          subtitle={`${formatCompactNumber(stats.totalInputTokens)} in / ${formatCompactNumber(
            stats.totalOutputTokens
          )} out`}
          icon={<HiOutlineCircleStack className="size-5" />}
          loading={loading}
        />

        <UsageCard
          title="Total Cost"
          value={formatCost(stats.totalCost)}
          subtitle={`${formatCost(stats.totalInputCost)} in / ${formatCost(
            stats.totalOutputCost
          )} out`}
          icon={<HiOutlineCurrencyDollar className="size-5" />}
          loading={loading}
        />

        <UsageCard
          title="Avg Latency"
          value={formatLatency(stats.averageLatency)}
          subtitle={getLatencyLabel(stats.averageLatency)}
          icon={<HiOutlineClock className="size-5" />}
          loading={loading}
        />

        <UsageCard
          title="Avg Messages/Chat"
          value={avgMessagesPerConversation.toFixed(1)}
          subtitle="per conversation"
          icon={<HiOutlineChartBar className="size-5" />}
          loading={loading}
        />

        <UsageCard
          title="Plan Status"
          value={subscription.isPro ? "PRO" : "Free"}
          subtitle={
            subscription.isPro
              ? hasCostCap
                ? `${formatCost(subscription.monthlyCostQuotaCents!)} fair-use cap`
                : "Unlimited access"
              : `${subscription.monthlyMessageLimit} msg/month`
          }
          icon={<HiOutlineSparkles className="size-5" />}
          loading={loading}
        />
      </div>
    </div>
  )
}

export default UsageSummary
