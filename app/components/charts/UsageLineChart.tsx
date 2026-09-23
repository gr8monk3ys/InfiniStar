"use client"

import { useMemo } from "react"
import { parseISO } from "date-fns"

import { formatDate, formatNumber } from "@/app/lib/intl-format"
import { cn } from "@/app/lib/utils"
import { ChartLoadingState, useRechartsModule } from "@/app/components/charts/useRechartsModule"

interface DailyUsageData {
  date: string
  requests: number
  tokens: number
  cost: number
}

interface UsageLineChartProps {
  data: DailyUsageData[]
  className?: string
  metric?: "requests" | "tokens" | "cost"
}

interface UsageTooltipProps {
  active?: boolean
  payload?: Array<{ value: number; name: string; color: string }>
  label?: string
}

const CHART_COLORS = {
  requests: "#8b5cf6", // purple
  tokens: "#06b6d4", // cyan
  cost: "#10b981", // emerald
}

const METRIC_LABELS = {
  requests: "Requests",
  tokens: "Tokens",
  cost: "Cost ($)",
}

const SHORT_DATE_FORMAT: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" }
const TOOLTIP_COST_FORMAT: Intl.NumberFormatOptions = {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 4,
  maximumFractionDigits: 4,
}
const AXIS_COST_FORMAT: Intl.NumberFormatOptions = { style: "currency", currency: "USD" }
const COMPACT_FORMAT: Intl.NumberFormatOptions = { notation: "compact", maximumFractionDigits: 1 }

function formatUsageTooltipValue(value: number, name: string) {
  if (name === "cost") {
    return [formatNumber(value, TOOLTIP_COST_FORMAT), "Cost"]
  }
  if (name === "tokens") {
    return [formatNumber(value), "Tokens"]
  }
  return [formatNumber(value), "Requests"]
}

function UsageTooltip({ active, payload, label }: UsageTooltipProps) {
  if (!active || !payload || payload.length === 0) return null

  return (
    <div className="rounded-lg border border-border bg-background p-3 shadow-lg">
      <p className="mb-2 text-sm font-medium text-foreground">{label}</p>
      {payload.map((entry) => {
        const [formattedValue, formattedName] = formatUsageTooltipValue(entry.value, entry.name)
        return (
          <p key={entry.name} className="text-sm tabular-nums" style={{ color: entry.color }}>
            {formattedName}: {formattedValue}
          </p>
        )
      })}
    </div>
  )
}

/**
 * Line chart showing daily AI usage trends over time
 */
export function UsageLineChart({ data, className, metric = "requests" }: UsageLineChartProps) {
  const recharts = useRechartsModule()

  // Process data for chart display
  const chartData = useMemo(() => {
    if (!data || data.length === 0) return []

    return data.map((item) => ({
      date: item.date,
      // parseISO keeps a bare "yyyy-MM-dd" in local time, so the day never shifts.
      formattedDate: formatDate(parseISO(item.date), SHORT_DATE_FORMAT),
      requests: item.requests,
      tokens: item.tokens,
      cost: item.cost / 100, // Convert cents to dollars
    }))
  }, [data])

  if (!chartData || chartData.length === 0) {
    return (
      <div
        className={cn(
          "flex h-[300px] items-center justify-center rounded-lg border border-dashed border-border bg-muted/30",
          className
        )}
        role="img"
        aria-label="No usage data available for the selected period"
      >
        <p className="text-sm text-muted-foreground">
          No usage data available for the selected period
        </p>
      </div>
    )
  }

  if (!recharts) {
    return (
      <ChartLoadingState
        className={cn("h-[300px] w-full", className)}
        ariaLabel="Loading usage trend chart"
      />
    )
  }

  const { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } =
    recharts

  return (
    <div
      className={cn("h-[300px] w-full", className)}
      role="img"
      aria-label={`Line chart showing daily ${metric} over time`}
    >
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
          <XAxis
            dataKey="formattedDate"
            tick={{ fontSize: 12 }}
            className="fill-muted-foreground"
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            tick={{ fontSize: 12 }}
            className="fill-muted-foreground"
            tickLine={false}
            axisLine={false}
            tickFormatter={(value: number) =>
              formatNumber(value, metric === "cost" ? AXIS_COST_FORMAT : COMPACT_FORMAT)
            }
          />
          <Tooltip content={<UsageTooltip />} />
          <Legend
            wrapperStyle={{ paddingTop: "10px" }}
            formatter={(value) => METRIC_LABELS[value as keyof typeof METRIC_LABELS] || value}
          />
          <Line
            type="monotone"
            dataKey={metric}
            name={metric}
            stroke={CHART_COLORS[metric]}
            strokeWidth={2}
            dot={{ fill: CHART_COLORS[metric], strokeWidth: 2, r: 3 }}
            activeDot={{ r: 5, strokeWidth: 2 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

export default UsageLineChart
