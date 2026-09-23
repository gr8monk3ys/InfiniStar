"use client"

import { useCallback, useEffect, useState } from "react"
import axios from "axios"

import { formatNumber } from "@/app/lib/intl-format"

type Period = "day" | "week" | "month"

const PERIOD_OPTIONS: Array<{ value: Period; label: string }> = [
  { value: "day", label: "Last Day" },
  { value: "week", label: "Last Week" },
  { value: "month", label: "Last Month" },
]

// Costs arrive in cents and are shown with sub-cent precision.
function formatCost(cents: number) {
  return formatNumber(cents / 100, {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 4,
    maximumFractionDigits: 4,
  })
}

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

interface QuotaInfo {
  withinQuota: boolean
  used: number
  remaining: number
  percentage: number
}

interface UsageData {
  stats: UsageStats
  quota: QuotaInfo
  period: {
    startDate: string
    endDate: string
  }
}

const AiUsageStats = () => {
  const [usageData, setUsageData] = useState<UsageData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [period, setPeriod] = useState<Period>("month")

  const fetchUsageData = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await axios.get(`/api/ai/usage?period=${period}`)
      setUsageData(response.data)
    } catch (err) {
      console.error("Failed to fetch usage data:", err)
      setError("Couldn't load your usage statistics. Try again later.")
    } finally {
      setLoading(false)
    }
  }, [period])

  useEffect(() => {
    void fetchUsageData()
  }, [fetchUsageData])

  if (loading) {
    return (
      <div className="rounded-lg border border-border bg-card p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-4 w-32 rounded bg-muted" />
          <div className="h-20 rounded bg-muted" />
        </div>
      </div>
    )
  }

  if (error || !usageData) {
    return (
      <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-6">
        <p className="text-sm text-destructive">
          {error || "Couldn't load your usage statistics. Try again later."}
        </p>
      </div>
    )
  }

  const { stats, quota } = usageData

  return (
    <div className="space-y-6">
      {/* Period Selector */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-foreground">AI Usage Statistics</h2>
        <div className="flex gap-2" role="group" aria-label="Select time period">
          {PERIOD_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setPeriod(option.value)}
              aria-pressed={period === option.value}
              className={`rounded-md px-3 py-1 text-sm font-medium transition ${
                period === option.value
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-foreground hover:bg-accent hover:text-accent-foreground"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {/* Quota Progress Bar */}
      <div className="rounded-lg border border-border bg-card p-6">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-medium text-foreground">Monthly Token Quota</h3>
          <span className="text-sm tabular-nums text-muted-foreground">
            {formatNumber(quota.used)} / {formatNumber(quota.used + quota.remaining)} tokens
          </span>
        </div>
        <div className="h-3 w-full overflow-hidden rounded-full bg-muted">
          <div
            className={`h-full w-full origin-left transition-transform ${
              quota.percentage > 90
                ? "bg-red-500"
                : quota.percentage > 70
                  ? "bg-yellow-500"
                  : "bg-primary"
            }`}
            style={{ transform: `scaleX(${Math.min(quota.percentage, 100) / 100})` }}
          />
        </div>
        <p className="mt-2 text-xs tabular-nums text-muted-foreground">
          {quota.withinQuota ? (
            <>
              {formatNumber(quota.remaining)} tokens remaining (
              {formatNumber((100 - quota.percentage) / 100, {
                style: "percent",
                minimumFractionDigits: 1,
                maximumFractionDigits: 1,
              })}
              )
            </>
          ) : (
            <span className="font-medium text-destructive">Quota exceeded</span>
          )}
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Total Requests */}
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-sm font-medium text-muted-foreground">Total Requests</p>
          <p className="mt-2 text-3xl font-bold tabular-nums text-foreground">
            {formatNumber(stats.totalRequests)}
          </p>
        </div>

        {/* Total Tokens */}
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-sm font-medium text-muted-foreground">Total Tokens</p>
          <p className="mt-2 text-3xl font-bold tabular-nums text-foreground">
            {formatNumber(stats.totalTokens)}
          </p>
          <p className="mt-1 text-xs tabular-nums text-muted-foreground">
            {formatNumber(stats.totalInputTokens)} in / {formatNumber(stats.totalOutputTokens)} out
          </p>
        </div>

        {/* Total Cost */}
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-sm font-medium text-muted-foreground">Total Cost</p>
          <p className="mt-2 text-3xl font-bold tabular-nums text-foreground">
            {formatCost(stats.totalCost)}
          </p>
          <p className="mt-1 text-xs tabular-nums text-muted-foreground">
            {formatCost(stats.totalInputCost)} in / {formatCost(stats.totalOutputCost)} out
          </p>
        </div>

        {/* Average Latency */}
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-sm font-medium text-muted-foreground">Avg Latency</p>
          <p className="mt-2 text-3xl font-bold tabular-nums text-foreground">
            {formatNumber(stats.averageLatency)}&nbsp;ms
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {stats.averageLatency < 2000 ? "Fast" : stats.averageLatency < 5000 ? "Normal" : "Slow"}
          </p>
        </div>
      </div>

      {/* Info Box */}
      <div className="rounded-lg border border-primary/20 bg-primary/10 p-4">
        <p className="text-sm text-primary-accent">
          <span className="font-medium">Note:</span> Usage tracking helps you monitor AI costs and
          stay within quota limits. Costs are estimates based on configured model pricing and
          multimodal cost assumptions.
        </p>
      </div>
    </div>
  )
}

export default AiUsageStats
