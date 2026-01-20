"use client"

import * as React from "react"
import { HiMinus, HiSquare3Stack3D, HiViewColumns } from "react-icons/hi2"

import { densitySpacing, type Density } from "@/app/lib/themes"
import { cn } from "@/app/lib/utils"

interface DensitySelectorProps {
  label: string
  description?: string
  value: Density
  onChange: (value: Density) => void
  className?: string
}

const densityOptions: { value: Density; icon: React.ReactNode }[] = [
  { value: "compact", icon: <HiMinus className="size-5" aria-hidden="true" /> },
  { value: "comfortable", icon: <HiViewColumns className="size-5" aria-hidden="true" /> },
  { value: "spacious", icon: <HiSquare3Stack3D className="size-5" aria-hidden="true" /> },
]

export function DensitySelector({
  label,
  description,
  value,
  onChange,
  className,
}: DensitySelectorProps) {
  return (
    <div className={cn("space-y-3", className)}>
      <div>
        <span className="block text-sm font-medium text-gray-700 dark:text-gray-300">{label}</span>
        {description && (
          <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{description}</p>
        )}
      </div>

      <div className="flex gap-2" role="radiogroup" aria-label={label}>
        {densityOptions.map((option) => (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={value === option.value}
            onClick={() => onChange(option.value)}
            className={cn(
              "flex flex-1 flex-col items-center gap-1 rounded-lg border-2 px-4 py-3 transition-all",
              value === option.value
                ? "border-sky-500 bg-sky-50 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300"
                : "border-gray-200 bg-white text-gray-600 hover:border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:border-gray-600"
            )}
          >
            {option.icon}
            <span className="text-xs font-medium">{densitySpacing[option.value].label}</span>
          </button>
        ))}
      </div>

      {/* Visual preview of spacing */}
      <div className="rounded-md border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-800">
        <p className="mb-2 text-xs text-gray-500 dark:text-gray-400">Preview</p>
        <div
          className="space-y-0 transition-all duration-200"
          style={{
            gap: `${0.5 * densitySpacing[value].base}rem`,
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div
            className="rounded bg-gray-300 transition-all duration-200 dark:bg-gray-600"
            style={{
              height: `${1.5 * densitySpacing[value].base}rem`,
              padding: `${0.25 * densitySpacing[value].base}rem`,
            }}
          />
          <div
            className="rounded bg-gray-300 transition-all duration-200 dark:bg-gray-600"
            style={{
              height: `${1.5 * densitySpacing[value].base}rem`,
              padding: `${0.25 * densitySpacing[value].base}rem`,
            }}
          />
          <div
            className="rounded bg-gray-300 transition-all duration-200 dark:bg-gray-600"
            style={{
              height: `${1.5 * densitySpacing[value].base}rem`,
              padding: `${0.25 * densitySpacing[value].base}rem`,
            }}
          />
        </div>
      </div>
    </div>
  )
}
