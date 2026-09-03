"use client"

import { useCallback, useMemo } from "react"
import { HiOutlineCalendar, HiOutlineXMark } from "react-icons/hi2"

interface DateRangePickerProps {
  dateFrom: string
  dateTo: string
  onDateFromChange: (date: string) => void
  onDateToChange: (date: string) => void
  onClear: () => void
  className?: string
}

/**
 * Quick date range presets
 */
const DATE_PRESETS = [
  { label: "Today", days: 0 },
  { label: "Last 7 days", days: 7 },
  { label: "Last 30 days", days: 30 },
  { label: "Last 90 days", days: 90 },
] as const

/**
 * DateRangePicker Component
 *
 * A date range selector with preset options for quick filtering.
 * Supports manual date input and preset buttons.
 */
export function DateRangePicker({
  dateFrom,
  dateTo,
  onDateFromChange,
  onDateToChange,
  onClear,
  className = "",
}: DateRangePickerProps) {
  // Format date for input element (YYYY-MM-DD)
  const formatDateForInput = useCallback((date: Date): string => {
    return date.toISOString().split("T")[0]
  }, [])

  // Get today's date formatted for max attribute
  const today = useMemo(() => formatDateForInput(new Date()), [formatDateForInput])

  // Apply a preset date range
  const applyPreset = useCallback(
    (days: number) => {
      const endDate = new Date()
      const startDate = new Date()

      if (days === 0) {
        // Today only
        onDateFromChange(formatDateForInput(startDate))
        onDateToChange(formatDateForInput(endDate))
      } else {
        startDate.setDate(startDate.getDate() - days)
        onDateFromChange(formatDateForInput(startDate))
        onDateToChange(formatDateForInput(endDate))
      }
    },
    [formatDateForInput, onDateFromChange, onDateToChange]
  )

  // Check if a preset is currently active
  const activePreset = useMemo(() => {
    if (!dateFrom || !dateTo) return null

    const fromDate = new Date(dateFrom)
    const toDate = new Date(dateTo)
    const todayDate = new Date()
    todayDate.setHours(0, 0, 0, 0)

    for (const preset of DATE_PRESETS) {
      const presetStart = new Date(todayDate)
      presetStart.setDate(presetStart.getDate() - preset.days)

      const fromMatch = fromDate.toDateString() === presetStart.toDateString()
      const toMatch = toDate.toDateString() === todayDate.toDateString()

      if (fromMatch && toMatch) {
        return preset.days
      }
    }

    return null
  }, [dateFrom, dateTo])

  const hasDateRange = dateFrom || dateTo

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Preset buttons */}
      <div className="flex flex-wrap gap-1.5">
        {DATE_PRESETS.map((preset) => (
          <button
            key={preset.days}
            type="button"
            onClick={() => applyPreset(preset.days)}
            className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
              activePreset === preset.days
                ? "bg-primary/10 text-primary-accent ring-1 ring-primary/20"
                : "bg-muted text-muted-foreground hover:bg-border"
            }`}
            aria-pressed={activePreset === preset.days}
          >
            {preset.label}
          </button>
        ))}
        {hasDateRange && (
          <button
            type="button"
            onClick={onClear}
            className="flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-border"
            aria-label="Clear date range"
          >
            <HiOutlineXMark className="size-3" />
            Clear
          </button>
        )}
      </div>

      {/* Manual date inputs */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label
            htmlFor="date-from"
            className="mb-1 flex items-center gap-1 text-xs font-medium text-foreground"
          >
            <HiOutlineCalendar className="size-3.5" />
            From
          </label>
          <input
            id="date-from"
            type="date"
            value={dateFrom}
            onChange={(e) => onDateFromChange(e.target.value)}
            max={dateTo || today}
            className="block w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            aria-label="Start date"
          />
        </div>
        <div>
          <label
            htmlFor="date-to"
            className="mb-1 flex items-center gap-1 text-xs font-medium text-foreground"
          >
            <HiOutlineCalendar className="size-3.5" />
            To
          </label>
          <input
            id="date-to"
            type="date"
            value={dateTo}
            onChange={(e) => onDateToChange(e.target.value)}
            min={dateFrom || undefined}
            max={today}
            className="block w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            aria-label="End date"
          />
        </div>
      </div>

      {/* Date range summary */}
      {hasDateRange && (
        <p className="text-xs text-muted-foreground">
          Showing results{" "}
          {dateFrom && (
            <>
              from <span className="font-medium">{dateFrom}</span>
            </>
          )}
          {dateFrom && dateTo && " "}
          {dateTo && (
            <>
              to <span className="font-medium">{dateTo}</span>
            </>
          )}
        </p>
      )}
    </div>
  )
}

export default DateRangePicker
