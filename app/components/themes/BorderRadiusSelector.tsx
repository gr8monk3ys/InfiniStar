"use client"

import * as React from "react"

import { borderRadiusValues, type BorderRadius } from "@/app/lib/themes"
import { cn } from "@/app/lib/utils"

interface BorderRadiusSelectorProps {
  label: string
  description?: string
  value: BorderRadius
  onChange: (value: BorderRadius) => void
  className?: string
}

const radiusOptions: { value: BorderRadius; label: string }[] = [
  { value: "none", label: "None" },
  { value: "small", label: "Small" },
  { value: "medium", label: "Medium" },
  { value: "large", label: "Large" },
  { value: "full", label: "Full" },
]

export function BorderRadiusSelector({
  label,
  description,
  value,
  onChange,
  className,
}: BorderRadiusSelectorProps) {
  return (
    <div className={cn("space-y-3", className)}>
      <div>
        <span className="block text-sm font-medium text-foreground">{label}</span>
        {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
      </div>

      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={label}>
        {radiusOptions.map((option) => (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={value === option.value}
            onClick={() => onChange(option.value)}
            className={cn(
              "flex flex-col items-center gap-2 border-2 px-4 py-3 transition-all",
              value === option.value
                ? "border-primary bg-primary/10 text-primary"
                : "border-border bg-card text-muted-foreground hover:border-primary/30"
            )}
            style={{ borderRadius: borderRadiusValues[option.value] }}
          >
            <div
              className={cn(
                "size-8 border-2",
                value === option.value ? "border-primary bg-primary/20" : "border-border bg-muted"
              )}
              style={{ borderRadius: borderRadiusValues[option.value] }}
            />
            <span className="text-xs font-medium">{option.label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
