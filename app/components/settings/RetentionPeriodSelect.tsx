"use client"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/app/components/ui/select"

// Retention period options
const RETENTION_OPTIONS = [
  { value: "7", label: "1 week" },
  { value: "14", label: "2 weeks" },
  { value: "30", label: "1 month" },
  { value: "60", label: "2 months" },
  { value: "90", label: "3 months" },
  { value: "180", label: "6 months" },
  { value: "365", label: "1 year" },
] as const

interface RetentionPeriodSelectProps {
  /** Lets a visible `<label htmlFor>` name the trigger. */
  id?: string
  value: number
  onChange: (value: number) => void
  disabled?: boolean
}

export function RetentionPeriodSelect({
  id,
  value,
  onChange,
  disabled = false,
}: RetentionPeriodSelectProps) {
  return (
    <Select
      value={value.toString()}
      onValueChange={(val) => onChange(parseInt(val, 10))}
      disabled={disabled}
    >
      <SelectTrigger
        id={id}
        className="w-full"
        aria-label={id ? undefined : "Select retention period"}
      >
        <SelectValue placeholder="Select retention period" />
      </SelectTrigger>
      <SelectContent>
        {RETENTION_OPTIONS.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

export default RetentionPeriodSelect
