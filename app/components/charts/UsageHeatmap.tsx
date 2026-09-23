"use client"

import { useMemo } from "react"

import { formatDate } from "@/app/lib/intl-format"
import { cn } from "@/app/lib/utils"

interface HeatmapData {
  day: number
  hour: number
  count: number
}

interface UsageHeatmapProps {
  data: HeatmapData[]
  className?: string
}

const HOURS = Array.from({ length: 24 }, (_, i) => i)
const LABELED_HOURS = HOURS.filter((h) => h % 3 === 0)
const DAY_INDEXES = [0, 1, 2, 3, 4, 5, 6]
const LEGEND_SWATCHES = [
  "bg-muted/30",
  "bg-primary/20",
  "bg-primary/40",
  "bg-primary/60",
  "bg-primary/80",
  "bg-primary",
]

// 2023-01-01 was a Sunday, so day index 0 lines up with the data's Sunday = 0.
function dayLabel(dayIndex: number): string {
  return formatDate(new Date(2023, 0, 1 + dayIndex), { weekday: "short" })
}

/**
 * Get color intensity based on count relative to max
 */
function getHeatmapColor(count: number, maxCount: number): string {
  if (count === 0) return "bg-muted/30"

  const intensity = maxCount > 0 ? count / maxCount : 0

  if (intensity < 0.2) return "bg-primary/20"
  if (intensity < 0.4) return "bg-primary/40"
  if (intensity < 0.6) return "bg-primary/60"
  if (intensity < 0.8) return "bg-primary/80"
  return "bg-primary"
}

/**
 * Format hour for display in the viewer's locale ("3 PM", "15")
 */
function formatHour(hour: number): string {
  return formatDate(new Date(2023, 0, 1, hour), { hour: "numeric" })
}

/**
 * Heatmap showing AI usage patterns by day of week and hour
 */
export function UsageHeatmap({ data, className }: UsageHeatmapProps) {
  // Process data into a 2D grid
  const { grid, maxCount } = useMemo(() => {
    // Initialize grid with zeros
    const grid: number[][] = Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => 0))

    let max = 0

    if (data && data.length > 0) {
      for (const item of data) {
        if (item.day >= 0 && item.day < 7 && item.hour >= 0 && item.hour < 24) {
          grid[item.day][item.hour] = item.count
          if (item.count > max) max = item.count
        }
      }
    }

    return { grid, maxCount: max }
  }, [data])

  // Locale labels are computed once per mount, not once per cell
  const { hourLabels, dayLabels } = useMemo(
    () => ({ hourLabels: HOURS.map(formatHour), dayLabels: DAY_INDEXES.map(dayLabel) }),
    []
  )

  // Check if there's any data
  const hasData = maxCount > 0

  if (!hasData) {
    return (
      <div
        className={cn(
          "flex h-[300px] items-center justify-center rounded-lg border border-dashed border-border bg-muted/30",
          className
        )}
        role="img"
        aria-label="No activity pattern data available"
      >
        <p className="text-sm text-muted-foreground">No activity pattern data available</p>
      </div>
    )
  }

  return (
    <div
      className={cn("w-full overflow-x-auto", className)}
      role="img"
      aria-label="Heatmap showing AI usage patterns by day of week and hour"
    >
      <div className="min-w-[600px]">
        {/* Hour labels */}
        <div className="mb-1 flex">
          <div className="w-10 shrink-0" /> {/* Spacer for day labels */}
          <div className="flex flex-1 justify-between px-0.5">
            {LABELED_HOURS.map((hour) => (
              <span
                key={hour}
                className="text-xs text-muted-foreground"
                style={{ width: "12.5%", textAlign: "center" }}
              >
                {hourLabels[hour]}
              </span>
            ))}
          </div>
        </div>

        {/* Grid rows */}
        <div className="space-y-1">
          {DAY_INDEXES.map((dayIndex) => {
            const day = dayLabels[dayIndex]
            return (
              <div key={dayIndex} className="flex items-center gap-1">
                {/* Day label */}
                <span className="w-10 shrink-0 text-xs text-muted-foreground">{day}</span>

                {/* Hour cells */}
                <div className="flex flex-1 gap-0.5">
                  {HOURS.map((hour) => {
                    const count = grid[dayIndex][hour]
                    return (
                      <div
                        key={hour}
                        className={cn(
                          "h-5 flex-1 rounded-sm transition-colors",
                          getHeatmapColor(count, maxCount)
                        )}
                        title={`${day} ${hourLabels[hour]}: ${count} ${
                          count === 1 ? "message" : "messages"
                        }`}
                      />
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>

        {/* Legend */}
        <div className="mt-4 flex items-center justify-end gap-2">
          <span className="text-xs text-muted-foreground">Less</span>
          <div className="flex gap-0.5">
            {LEGEND_SWATCHES.map((swatch) => (
              <div key={swatch} className={cn("size-4 rounded-sm", swatch)} />
            ))}
          </div>
          <span className="text-xs text-muted-foreground">More</span>
        </div>
      </div>
    </div>
  )
}

export default UsageHeatmap
