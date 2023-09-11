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
        <label htmlFor={id} className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          {label}
        </label>
        {description && (
          <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{description}</p>
        )}
      </div>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value as FontFamily)}
        className="block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
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
        className="mt-2 rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800"
        style={{ fontFamily: fontFamilyValues[value] }}
      >
        <p className="text-gray-700 dark:text-gray-300">
          The quick brown fox jumps over the lazy dog.
        </p>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          ABCDEFGHIJKLMNOPQRSTUVWXYZ 0123456789
        </p>
      </div>
    </div>
  )
}
