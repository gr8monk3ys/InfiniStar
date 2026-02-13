"use client"

import { useMemo } from "react"
import { format, parseISO } from "date-fns"
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

import { cn } from "@/app/lib/utils"

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

/**
 * Line chart showing daily AI usage trends over time
 */
export function UsageLineChart({ data, className, metric = "requests" }: UsageLineChartProps) {
  // Process data for chart display
  const chartData = useMemo(() => {
    if (!data || data.length === 0) return []

    return data.map((item) => ({
      date: item.date,
      formattedDate: format(parseISO(item.date), "MMM d"),
      requests: item.requests,
      tokens: item.tokens,
      cost: item.cost / 100, // Convert cents to dollars
    }))
  }, [data])

  // Custom tooltip formatter
  const formatTooltipValue = (value: number, name: string) => {
    if (name === "cost") {
      return [`$${value.toFixed(4)}`, "Cost"]
    }
    if (name === "tokens") {
      return [value.toLocaleString(), "Tokens"]
    }
    return [value.toString(), "Requests"]
  }

  // Custom tooltip component
  const CustomTooltip = ({
    active,
    payload,
    label,
  }: {
    active?: boolean
    payload?: Array<{ value: number; name: string; color: string }>
    label?: string
  }) => {
    if (!active || !payload || payload.length === 0) return null

    return (
      <div className="rounded-lg border border-border bg-background p-3 shadow-lg">
        <p className="mb-2 text-sm font-medium text-foreground">{label}</p>
        {payload.map((entry) => {
          const [formattedValue, formattedName] = formatTooltipValue(entry.value, entry.name)
          return (
            <p key={entry.name} className="text-sm" style={{ color: entry.color }}>
              {formattedName}: {formattedValue}
            </p>
          )
        })}
      </div>
    )
  }

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
            tickFormatter={(value) =>
              metric === "cost"
                ? `$${value.toFixed(2)}`
                : value >= 1000
                  ? `${(value / 1000).toFixed(1)}k`
                  : value.toString()
            }
          />
          <Tooltip content={<CustomTooltip />} />
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
