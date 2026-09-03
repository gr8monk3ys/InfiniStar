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
        <span className="block text-sm font-medium text-foreground">{label}</span>
        {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
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
                ? "border-primary bg-primary/10 text-primary"
                : "border-border bg-card text-muted-foreground hover:border-primary/30"
            )}
          >
            {option.icon}
            <span className="text-xs font-medium">{densitySpacing[option.value].label}</span>
          </button>
        ))}
      </div>

      {/* Visual preview of spacing */}
      <div className="rounded-md border border-border bg-muted p-3">
        <p className="mb-2 text-xs text-muted-foreground">Preview</p>
        <div
          className="space-y-0 transition-all duration-200"
          style={{
            gap: `${0.5 * densitySpacing[value].base}rem`,
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div
            className="rounded bg-border transition-all duration-200"
            style={{
              height: `${1.5 * densitySpacing[value].base}rem`,
              padding: `${0.25 * densitySpacing[value].base}rem`,
            }}
          />
          <div
            className="rounded bg-border transition-all duration-200"
            style={{
              height: `${1.5 * densitySpacing[value].base}rem`,
              padding: `${0.25 * densitySpacing[value].base}rem`,
            }}
          />
          <div
            className="rounded bg-border transition-all duration-200"
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
