"use client"

import { cn } from "@/app/lib/utils"

export type Period = "day" | "week" | "month"

interface PeriodSelectorProps {
  value: Period
  onChange: (period: Period) => void
  className?: string
}

export const PERIODS: Array<{ value: Period; label: string }> = [
  { value: "day", label: "Last Day" },
  { value: "week", label: "Last Week" },
  { value: "month", label: "Last Month" },
]

/**
 * Period selector component for filtering usage data by time range
 */
export function PeriodSelector({ value, onChange, className }: PeriodSelectorProps) {
  return (
    <div
      className={cn("flex rounded-lg border border-border bg-background p-1", className)}
      role="group"
      aria-label="Select time period"
    >
      {PERIODS.map((period) => (
        <button
          key={period.value}
          type="button"
          onClick={() => onChange(period.value)}
          aria-pressed={value === period.value}
          className={cn(
            "rounded-md px-3 py-1.5 text-sm font-medium transition",
            value === period.value
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          )}
        >
          {period.label}
        </button>
      ))}
    </div>
  )
}

export default PeriodSelector
