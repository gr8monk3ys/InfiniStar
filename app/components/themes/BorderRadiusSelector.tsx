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
        <span className="block text-sm font-medium text-gray-700 dark:text-gray-300">{label}</span>
        {description && (
          <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{description}</p>
        )}
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
                ? "border-sky-500 bg-sky-50 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300"
                : "border-gray-200 bg-white text-gray-600 hover:border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:border-gray-600"
            )}
            style={{ borderRadius: borderRadiusValues[option.value] }}
          >
            <div
              className={cn(
                "size-8 border-2",
                value === option.value
                  ? "border-sky-500 bg-sky-100 dark:bg-sky-800"
                  : "border-gray-300 bg-gray-100 dark:border-gray-600 dark:bg-gray-700"
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
