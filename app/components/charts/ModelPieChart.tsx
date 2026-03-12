"use client"

import { useMemo } from "react"

import { cn } from "@/app/lib/utils"
import { ChartLoadingState, useRechartsModule } from "@/app/components/charts/useRechartsModule"

interface ModelUsageData {
  model: string
  count: number
  tokens: number
  cost: number
}

interface ModelPieChartProps {
  data: ModelUsageData[]
  className?: string
  metric?: "count" | "tokens" | "cost"
}

interface ModelChartDatum {
  name: string
  value: number
  color: string
}

interface ModelPieTooltipProps {
  active?: boolean
  payload?: Array<{
    payload: { name: string; value: number }
  }>
  metric: NonNullable<ModelPieChartProps["metric"]>
  total: number
}

interface PieLabelRenderProps {
  cx?: number | string
  cy?: number | string
  midAngle?: number
  innerRadius?: number | string
  outerRadius?: number | string
  percent?: number
}

// Colors for different models
const MODEL_COLORS: Record<string, string> = {
  "Claude Sonnet 4.5": "#8b5cf6", // purple
  "Claude Haiku 4.5": "#06b6d4", // cyan
  // Legacy labels (for older rows in analytics)
  "Claude 3.5 Sonnet": "#8b5cf6",
  "Claude 3 Opus": "#f97316",
  "Claude 3 Haiku": "#06b6d4",
}

const DEFAULT_COLORS = ["#8b5cf6", "#f97316", "#06b6d4", "#22c55e", "#ec4899"]

function ModelPieTooltip({ active, payload, metric, total }: ModelPieTooltipProps) {
  if (!active || !payload || payload.length === 0) return null

  const item = payload[0].payload
  const percentage = total > 0 ? ((item.value / total) * 100).toFixed(1) : 0

  return (
    <div className="rounded-lg border border-border bg-background p-3 shadow-lg">
      <p className="mb-1 text-sm font-medium text-foreground">{item.name}</p>
      <p className="text-sm text-muted-foreground">
        {metric === "cost" ? (
          <>
            Cost: <span className="font-medium text-foreground">${item.value.toFixed(4)}</span>
          </>
        ) : metric === "tokens" ? (
          <>
            Tokens:{" "}
            <span className="font-medium text-foreground">{item.value.toLocaleString()}</span>
          </>
        ) : (
          <>
            Messages:{" "}
            <span className="font-medium text-foreground">{item.value.toLocaleString()}</span>
          </>
        )}
      </p>
      <p className="text-sm text-muted-foreground">
        Share: <span className="font-medium text-foreground">{percentage}%</span>
      </p>
    </div>
  )
}

function renderModelPieLegendText(value: string) {
  return <span className="text-sm text-foreground">{value}</span>
}

function renderModelPieLabel({
  cx,
  cy,
  midAngle,
  innerRadius,
  outerRadius,
  percent,
}: PieLabelRenderProps) {
  if (
    typeof cx !== "number" ||
    typeof cy !== "number" ||
    typeof midAngle !== "number" ||
    typeof innerRadius !== "number" ||
    typeof outerRadius !== "number" ||
    typeof percent !== "number"
  ) {
    return null
  }
  if (percent < 0.05) return null

  const RADIAN = Math.PI / 180
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5
  const x = cx + radius * Math.cos(-midAngle * RADIAN)
  const y = cy + radius * Math.sin(-midAngle * RADIAN)

  return (
    <text
      x={x}
      y={y}
      fill="white"
      textAnchor="middle"
      dominantBaseline="central"
      className="text-xs font-medium"
    >
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  )
}

/**
 * Pie chart showing distribution of AI model usage
 */
export function ModelPieChart({ data, className, metric = "count" }: ModelPieChartProps) {
  const recharts = useRechartsModule()

  // Process data for chart display
  const chartData = useMemo(() => {
    if (!data || data.length === 0) return []

    return data.map<ModelChartDatum>((item, index) => ({
      name: item.model,
      value: metric === "count" ? item.count : metric === "tokens" ? item.tokens : item.cost / 100, // Convert cents to dollars
      color: MODEL_COLORS[item.model] || DEFAULT_COLORS[index % DEFAULT_COLORS.length],
    }))
  }, [data, metric])

  // Calculate total for percentage display
  const total = useMemo(() => {
    return chartData.reduce((sum, item) => sum + item.value, 0)
  }, [chartData])

  if (!chartData || chartData.length === 0) {
    return (
      <div
        className={cn(
          "flex h-[300px] items-center justify-center rounded-lg border border-dashed border-border bg-muted/30",
          className
        )}
        role="img"
        aria-label="No model usage data available"
      >
        <p className="text-sm text-muted-foreground">No model usage data available</p>
      </div>
    )
  }

  if (!recharts) {
    return (
      <ChartLoadingState
        className={cn("h-[300px] w-full", className)}
        ariaLabel="Loading model usage chart"
      />
    )
  }

  const { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } = recharts

  return (
    <div
      className={cn("h-[300px] w-full", className)}
      role="img"
      aria-label={`Pie chart showing ${
        metric === "count" ? "message count" : metric === "tokens" ? "token usage" : "cost"
      } distribution by AI model`}
    >
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={renderModelPieLabel}
            outerRadius={100}
            innerRadius={50}
            paddingAngle={2}
            dataKey="value"
          >
            {chartData.map((entry) => (
              <Cell
                key={`cell-${entry.name}`}
                fill={entry.color}
                stroke="hsl(var(--background))"
                strokeWidth={2}
              />
            ))}
          </Pie>
          <Tooltip content={<ModelPieTooltip metric={metric} total={total} />} />
          <Legend verticalAlign="bottom" height={36} formatter={renderModelPieLegendText} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}

export default ModelPieChart
