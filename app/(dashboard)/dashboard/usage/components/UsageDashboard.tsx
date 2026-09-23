"use client"

import { useCallback, useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import axios from "axios"
import { HiOutlineArrowPath } from "react-icons/hi2"

import { formatDate } from "@/app/lib/intl-format"
import { cn } from "@/app/lib/utils"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/app/components/ui/card"
import {
  LazyModelPieChart as ModelPieChart,
  LazyPersonalityBarChart as PersonalityBarChart,
  LazyUsageHeatmap as UsageHeatmap,
  // Using lazy-loaded versions for code-splitting Recharts (~200KB)
  LazyUsageLineChart as UsageLineChart,
  UsageSummary,
} from "@/app/components/charts"

import { ChartSkeleton, SummarySkeleton } from "./LoadingSkeletons"
import { PERIODS, PeriodSelector, type Period } from "./PeriodSelector"

// Type definitions for API response
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

interface DailyUsageData {
  date: string
  requests: number
  tokens: number
  cost: number
}

interface ModelUsageData {
  model: string
  count: number
  tokens: number
  cost: number
}

interface PersonalityUsageData {
  personality: string
  count: number
  tokens: number
}

interface HeatmapData {
  day: number
  hour: number
  count: number
}

interface PeakHour {
  hour: number
  count: number
}

interface UsageData {
  stats: UsageStats
  subscription: SubscriptionInfo
  dailyUsage: DailyUsageData[] | null
  modelUsage: ModelUsageData[]
  personalityUsage: PersonalityUsageData[]
  hourlyUsage: HeatmapData[]
  avgMessagesPerConversation: number
  peakUsageHours: PeakHour[]
  period: {
    startDate: string
    endDate: string
  }
}

type LineChartMetric = "requests" | "tokens" | "cost"
type ModelChartMetric = "count" | "tokens" | "cost"
type PersonalityChartMetric = "count" | "tokens"

const DEFAULT_PERIOD: Period = "month"

function isPeriod(value: string | null): value is Period {
  return PERIODS.some((p) => p.value === value)
}

const LINE_CHART_OPTIONS: Array<{ value: LineChartMetric; label: string }> = [
  { value: "requests", label: "Messages" },
  { value: "tokens", label: "Tokens" },
  { value: "cost", label: "Cost" },
]

const MODEL_CHART_OPTIONS: Array<{ value: ModelChartMetric; label: string }> = [
  { value: "count", label: "Messages" },
  { value: "tokens", label: "Tokens" },
  { value: "cost", label: "Cost" },
]

const PERSONALITY_CHART_OPTIONS: Array<{ value: PersonalityChartMetric; label: string }> = [
  { value: "count", label: "Messages" },
  { value: "tokens", label: "Tokens" },
]

/** Locale-aware hour label ("3 PM", "15 h", …) for an hour of the day (0–23). */
function formatHour(hour: number): string {
  return formatDate(new Date(2000, 0, 1, hour), { hour: "numeric" })
}

// Format peak hours for display
function formatPeakHours(hours: PeakHour[]): string {
  if (!hours || hours.length === 0) return "No data"
  return hours
    .slice(0, 3)
    .map((h) => formatHour(h.hour))
    .join(", ")
}

/**
 * Main usage dashboard component
 */
export function UsageDashboard() {
  const [usageData, setUsageData] = useState<UsageData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  // The period is a filter, so it lives in the URL (?period=…) and can be deep-linked.
  const searchParams = useSearchParams()
  const requestedPeriod = searchParams.get("period")
  const period: Period = isPeriod(requestedPeriod) ? requestedPeriod : DEFAULT_PERIOD
  const setPeriod = (next: Period) => {
    const params = new URLSearchParams(window.location.search)
    if (next === DEFAULT_PERIOD) {
      params.delete("period")
    } else {
      params.set("period", next)
    }
    const query = params.toString()
    // Native replaceState updates useSearchParams without a server round trip.
    window.history.replaceState(null, "", `${window.location.pathname}${query ? `?${query}` : ""}`)
  }
  const [lineChartMetric, setLineChartMetric] = useState<LineChartMetric>("requests")
  const [modelChartMetric, setModelChartMetric] = useState<ModelChartMetric>("count")
  const [personalityChartMetric, setPersonalityChartMetric] =
    useState<PersonalityChartMetric>("count")

  const fetchUsageData = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await axios.get(`/api/ai/usage?period=${period}`)
      setUsageData(response.data)
    } catch (err) {
      console.error("Failed to fetch usage data:", err)
      setError("Couldn't load your usage statistics. Check your connection and try again.")
    } finally {
      setLoading(false)
    }
  }, [period])

  useEffect(() => {
    void fetchUsageData()
  }, [fetchUsageData])

  // Error state
  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground sm:text-3xl">AI Usage Dashboard</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Track your AI usage, costs, and activity patterns
            </p>
          </div>
        </div>

        <div className="flex flex-col items-center justify-center rounded-lg border border-destructive/50 bg-destructive/10 p-8">
          <p className="mb-4 text-center text-sm text-destructive">{error}</p>
          <button
            type="button"
            onClick={fetchUsageData}
            className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            <HiOutlineArrowPath className="size-4" aria-hidden="true" />
            Try Again
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground sm:text-3xl">AI Usage Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Track your AI usage, costs, and activity patterns
          </p>
        </div>

        <div className="flex items-center gap-2">
          <PeriodSelector value={period} onChange={setPeriod} />
          <button
            type="button"
            onClick={fetchUsageData}
            disabled={loading}
            className={cn(
              "flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent",
              loading && "cursor-not-allowed opacity-50"
            )}
            aria-label="Refresh data"
          >
            <HiOutlineArrowPath
              className={cn("size-4", loading && "animate-spin")}
              aria-hidden="true"
            />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>
      </div>

      {/* Usage Summary */}
      {loading || !usageData ? (
        <SummarySkeleton />
      ) : (
        <UsageSummary
          stats={usageData.stats}
          subscription={usageData.subscription}
          avgMessagesPerConversation={usageData.avgMessagesPerConversation}
        />
      )}

      {/* Charts Grid */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        {/* Daily Usage Line Chart */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div>
              <CardTitle className="text-base font-semibold">Daily Usage Trend</CardTitle>
              <CardDescription>
                {period === "day"
                  ? "Last 24 hours"
                  : period === "week"
                    ? "Last 7 days"
                    : "Last 30 days"}
              </CardDescription>
            </div>
            <MetricToggle
              label="Daily usage metric"
              options={LINE_CHART_OPTIONS}
              value={lineChartMetric}
              onChange={setLineChartMetric}
            />
          </CardHeader>
          <CardContent>
            {loading ? (
              <ChartSkeleton height={300} />
            ) : (
              <UsageLineChart data={usageData?.dailyUsage || []} metric={lineChartMetric} />
            )}
          </CardContent>
        </Card>

        {/* Model Distribution Pie Chart */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div>
              <CardTitle className="text-base font-semibold">Model Distribution</CardTitle>
              <CardDescription>Usage breakdown by AI model</CardDescription>
            </div>
            <MetricToggle
              label="Model distribution metric"
              options={MODEL_CHART_OPTIONS}
              value={modelChartMetric}
              onChange={setModelChartMetric}
            />
          </CardHeader>
          <CardContent>
            {loading ? (
              <ChartSkeleton height={300} />
            ) : (
              <ModelPieChart data={usageData?.modelUsage || []} metric={modelChartMetric} />
            )}
          </CardContent>
        </Card>

        {/* Personality Usage Bar Chart */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div>
              <CardTitle className="text-base font-semibold">Personality Usage</CardTitle>
              <CardDescription>Most used AI personalities</CardDescription>
            </div>
            <MetricToggle
              label="Personality usage metric"
              options={PERSONALITY_CHART_OPTIONS}
              value={personalityChartMetric}
              onChange={setPersonalityChartMetric}
            />
          </CardHeader>
          <CardContent>
            {loading ? (
              <ChartSkeleton height={300} />
            ) : (
              <PersonalityBarChart
                data={usageData?.personalityUsage || []}
                metric={personalityChartMetric}
              />
            )}
          </CardContent>
        </Card>

        {/* Activity Heatmap */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold">Activity Patterns</CardTitle>
            <CardDescription>
              When you use AI the most
              {usageData?.peakUsageHours && usageData.peakUsageHours.length > 0 && (
                <span className="ml-1">
                  — Peak hours: {formatPeakHours(usageData.peakUsageHours)}
                </span>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <ChartSkeleton height={220} />
            ) : (
              <UsageHeatmap data={usageData?.hourlyUsage || []} />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Info Box */}
      <div className="rounded-lg border border-primary/20 bg-primary/10 p-4">
        <p className="text-sm text-primary-accent">
          <span className="font-medium">Note:</span> Usage tracking helps you monitor AI costs and
          stay within quota limits. Costs are estimates based on configured model pricing and
          multimodal cost assumptions. Data is updated in real-time as you use the AI features.
        </p>
      </div>
    </div>
  )
}

/**
 * Toggle component for switching between chart metrics
 */
interface MetricToggleProps<T extends string> {
  label: string
  options: Array<{ value: T; label: string }>
  value: T
  onChange: (value: T) => void
}

function MetricToggle<T extends string>({ label, options, value, onChange }: MetricToggleProps<T>) {
  return (
    <div
      className="flex rounded-md border border-border bg-muted/50 p-0.5"
      role="group"
      aria-label={label}
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          aria-pressed={value === option.value}
          className={cn(
            "rounded-sm px-2 py-1 text-xs font-medium transition-colors",
            value === option.value
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

export default UsageDashboard
