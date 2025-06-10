"use client"

import { useMemo } from "react"

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

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
const HOURS = Array.from({ length: 24 }, (_, i) => i)

/**
 * Get color intensity based on count relative to max
 */
function getHeatmapColor(count: number, maxCount: number): string {
  if (count === 0) return "bg-muted/30"

  const intensity = maxCount > 0 ? count / maxCount : 0

  if (intensity < 0.2) return "bg-purple-200 dark:bg-purple-900/50"
  if (intensity < 0.4) return "bg-purple-300 dark:bg-purple-800/60"
  if (intensity < 0.6) return "bg-purple-400 dark:bg-purple-700/70"
  if (intensity < 0.8) return "bg-purple-500 dark:bg-purple-600/80"
  return "bg-purple-600 dark:bg-purple-500"
}

/**
 * Format hour for display
 */
function formatHour(hour: number): string {
  if (hour === 0) return "12a"
  if (hour === 12) return "12p"
  return hour < 12 ? `${hour}a` : `${hour - 12}p`
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
            {HOURS.filter((h) => h % 3 === 0).map((hour) => (
              <span
                key={hour}
                className="text-xs text-muted-foreground"
                style={{ width: "12.5%", textAlign: "center" }}
              >
                {formatHour(hour)}
              </span>
            ))}
          </div>
        </div>

        {/* Grid rows */}
        <div className="space-y-1">
          {DAYS.map((day, dayIndex) => (
            <div key={day} className="flex items-center gap-1">
              {/* Day label */}
              <span className="w-10 shrink-0 text-xs text-muted-foreground">{day}</span>

              {/* Hour cells */}
              <div className="flex flex-1 gap-0.5">
                {HOURS.map((hour) => {
                  const count = grid[dayIndex][hour]
                  return (
                    <div
                      key={`${day}-${hour}`}
                      className={cn(
                        "h-5 flex-1 rounded-sm transition-colors",
                        getHeatmapColor(count, maxCount)
                      )}
                      title={`${day} ${formatHour(hour)}: ${count} ${
                        count === 1 ? "message" : "messages"
                      }`}
                      role="gridcell"
                      aria-label={`${day} at ${formatHour(hour)}: ${count} messages`}
                    />
                  )
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Legend */}
        <div className="mt-4 flex items-center justify-end gap-2">
          <span className="text-xs text-muted-foreground">Less</span>
          <div className="flex gap-0.5">
            <div className="size-4 rounded-sm bg-muted/30" />
            <div className="size-4 rounded-sm bg-purple-200 dark:bg-purple-900/50" />
            <div className="size-4 rounded-sm bg-purple-300 dark:bg-purple-800/60" />
            <div className="size-4 rounded-sm bg-purple-400 dark:bg-purple-700/70" />
            <div className="size-4 rounded-sm bg-purple-500 dark:bg-purple-600/80" />
            <div className="size-4 rounded-sm bg-purple-600 dark:bg-purple-500" />
          </div>
          <span className="text-xs text-muted-foreground">More</span>
        </div>
      </div>
    </div>
  )
}

export default UsageHeatmap
