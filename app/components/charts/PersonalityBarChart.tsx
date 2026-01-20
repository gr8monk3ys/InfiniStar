"use client"

import { useMemo } from "react"
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

import { cn } from "@/app/lib/utils"

interface PersonalityUsageData {
  personality: string
  count: number
  tokens: number
}

interface PersonalityBarChartProps {
  data: PersonalityUsageData[]
  className?: string
  metric?: "count" | "tokens"
}

// Colors for different personalities
const PERSONALITY_COLORS: Record<string, string> = {
  "Helpful Assistant": "#3b82f6", // blue
  "Creative Writer": "#a855f7", // purple
  "Technical Expert": "#22c55e", // green
  "Friendly Companion": "#eab308", // yellow
  "Professional Consultant": "#6b7280", // gray
  "Socratic Tutor": "#6366f1", // indigo
  "Concise Advisor": "#f97316", // orange
  Custom: "#ec4899", // pink
}

const DEFAULT_COLOR = "#8b5cf6"

/**
 * Bar chart showing AI usage by personality type
 */
export function PersonalityBarChart({
  data,
  className,
  metric = "count",
}: PersonalityBarChartProps) {
  // Process data for chart display
  const chartData = useMemo(() => {
    if (!data || data.length === 0) return []

    return data
      .map((item) => ({
        name: item.personality,
        shortName:
          item.personality.length > 15 ? item.personality.slice(0, 12) + "..." : item.personality,
        value: metric === "count" ? item.count : item.tokens,
        color: PERSONALITY_COLORS[item.personality] || DEFAULT_COLOR,
      }))
      .slice(0, 8) // Limit to top 8 personalities
  }, [data, metric])

  // Custom tooltip component
  const CustomTooltip = ({
    active,
    payload,
  }: {
    active?: boolean
    payload?: Array<{
      payload: { name: string; value: number }
    }>
  }) => {
    if (!active || !payload || payload.length === 0) return null

    const item = payload[0].payload
    return (
      <div className="rounded-lg border border-border bg-background p-3 shadow-lg">
        <p className="mb-1 text-sm font-medium text-foreground">{item.name}</p>
        <p className="text-sm text-muted-foreground">
          {metric === "count" ? "Messages" : "Tokens"}:{" "}
          <span className="font-medium text-foreground">{item.value.toLocaleString()}</span>
        </p>
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
        aria-label="No personality usage data available"
      >
        <p className="text-sm text-muted-foreground">No personality usage data available</p>
      </div>
    )
  }

  return (
    <div
      className={cn("h-[300px] w-full", className)}
      role="img"
      aria-label={`Bar chart showing ${
        metric === "count" ? "message count" : "token usage"
      } by AI personality`}
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={chartData}
          layout="vertical"
          margin={{ top: 5, right: 20, left: 80, bottom: 5 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            className="stroke-border"
            horizontal={true}
            vertical={false}
          />
          <XAxis
            type="number"
            tick={{ fontSize: 12 }}
            className="fill-muted-foreground"
            tickLine={false}
            axisLine={false}
            tickFormatter={(value) =>
              value >= 1000 ? `${(value / 1000).toFixed(1)}k` : value.toString()
            }
          />
          <YAxis
            type="category"
            dataKey="shortName"
            tick={{ fontSize: 12 }}
            className="fill-muted-foreground"
            tickLine={false}
            axisLine={false}
            width={75}
          />
          <Tooltip
            content={<CustomTooltip />}
            cursor={{ fill: "hsl(var(--muted))", opacity: 0.5 }}
          />
          <Bar dataKey="value" radius={[0, 4, 4, 0]} maxBarSize={30}>
            {chartData.map((entry) => (
              <Cell key={`cell-${entry.name}`} fill={entry.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

export default PersonalityBarChart
