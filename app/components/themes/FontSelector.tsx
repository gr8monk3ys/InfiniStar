"use client"

import * as React from "react"

import { fontFamilyLabels, fontFamilyValues, type FontFamily } from "@/app/lib/themes"
import { cn } from "@/app/lib/utils"

interface FontSelectorProps {
  label: string
  description?: string
  value: FontFamily
  onChange: (value: FontFamily) => void
  id: string
  className?: string
}

const fontOptions: FontFamily[] = [
  "system",
  "inter",
  "roboto",
  "open-sans",
  "lato",
  "poppins",
  "source-sans",
  "nunito",
]

export function FontSelector({
  label,
  description,
  value,
  onChange,
  id,
  className,
}: FontSelectorProps) {
  return (
    <div className={cn("space-y-2", className)}>
      <div>
        <label htmlFor={id} className="block text-sm font-medium text-foreground">
          {label}
        </label>
        {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
      </div>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value as FontFamily)}
        className="block w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        aria-describedby={description ? `${id}-description` : undefined}
      >
        {fontOptions.map((font) => (
          <option key={font} value={font} style={{ fontFamily: fontFamilyValues[font] }}>
            {fontFamilyLabels[font]}
          </option>
        ))}
      </select>
      {/* Font preview */}
      <div
        className="mt-2 rounded-md border border-border bg-muted px-3 py-2 text-sm"
        style={{ fontFamily: fontFamilyValues[value] }}
      >
        <p className="text-foreground">The quick brown fox jumps over the lazy dog.</p>
        <p className="mt-1 text-xs text-muted-foreground">ABCDEFGHIJKLMNOPQRSTUVWXYZ 0123456789</p>
      </div>
    </div>
  )
}
