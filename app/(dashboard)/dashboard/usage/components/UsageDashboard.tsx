"use client"

import { useCallback, useEffect, useState } from "react"
import axios from "axios"
import { HiOutlineArrowPath } from "react-icons/hi2"

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
import { PeriodSelector } from "./PeriodSelector"

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

interface QuotaInfo {
  withinQuota: boolean
  used: number
  remaining: number
  percentage: number
}

interface SubscriptionInfo {
  isPro: boolean
  plan: string
  monthlyMessageCount: number
  monthlyMessageLimit: number | null
  remainingMessages: number | null
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
  quota: QuotaInfo
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

type Period = "day" | "week" | "month"
type LineChartMetric = "requests" | "tokens" | "cost"
type ModelChartMetric = "count" | "tokens" | "cost"
type PersonalityChartMetric = "count" | "tokens"

/**
 * Main usage dashboard component
 */
export function UsageDashboard() {
  const [usageData, setUsageData] = useState<UsageData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [period, setPeriod] = useState<Period>("month")
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
      setError("Failed to load usage statistics. Please try again.")
    } finally {
      setLoading(false)
    }
  }, [period])

  useEffect(() => {
    fetchUsageData()
  }, [fetchUsageData])

  // Format peak hours for display
  const formatPeakHours = (hours: PeakHour[]): string => {
    if (!hours || hours.length === 0) return "No data"
    return hours
      .slice(0, 3)
      .map((h) => {
        const hour = h.hour
        if (hour === 0) return "12 AM"
        if (hour === 12) return "12 PM"
        return hour < 12 ? `${hour} AM` : `${hour - 12} PM`
      })
      .join(", ")
  }

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
            onClick={fetchUsageData}
            className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            <HiOutlineArrowPath className="size-4" />
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
            onClick={fetchUsageData}
            disabled={loading}
            className={cn(
              "flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent",
              loading && "cursor-not-allowed opacity-50"
            )}
            aria-label="Refresh data"
          >
            <HiOutlineArrowPath className={cn("size-4", loading && "animate-spin")} />
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
          quota={usageData.quota}
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
              options={[
                { value: "requests", label: "Messages" },
                { value: "tokens", label: "Tokens" },
                { value: "cost", label: "Cost" },
              ]}
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
              options={[
                { value: "count", label: "Messages" },
                { value: "tokens", label: "Tokens" },
                { value: "cost", label: "Cost" },
              ]}
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
              options={[
                { value: "count", label: "Messages" },
                { value: "tokens", label: "Tokens" },
              ]}
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
                  - Peak hours: {formatPeakHours(usageData.peakUsageHours)}
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
      <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-900/50 dark:bg-blue-950/30">
        <p className="text-sm text-blue-800 dark:text-blue-200">
          <span className="font-medium">Note:</span> Usage tracking helps you monitor AI costs and
          stay within quota limits. Costs are estimates based on current Anthropic pricing. Data is
          updated in real-time as you use the AI features.
        </p>
      </div>
    </div>
  )
}

/**
 * Toggle component for switching between chart metrics
 */
interface MetricToggleProps<T extends string> {
  options: Array<{ value: T; label: string }>
  value: T
  onChange: (value: T) => void
}

function MetricToggle<T extends string>({ options, value, onChange }: MetricToggleProps<T>) {
  return (
    <div className="flex rounded-md border border-border bg-muted/50 p-0.5">
      {options.map((option) => (
        <button
          key={option.value}
          onClick={() => onChange(option.value)}
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
