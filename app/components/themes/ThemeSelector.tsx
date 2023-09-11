"use client"

import * as React from "react"

import { useThemeCustom } from "@/app/components/providers/ThemeCustomProvider"

import { ThemePreview } from "./ThemePreview"

interface ThemeSelectorProps {
  className?: string
}

export function ThemeSelector({ className }: ThemeSelectorProps) {
  const { currentTheme, presetThemes, setTheme, isLoading } = useThemeCustom()

  if (isLoading) {
    return (
      <div className={className}>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 7 }).map((_, index) => (
            <div
              // eslint-disable-next-line react/no-array-index-key -- Static skeleton placeholders
              key={`theme-selector-skeleton-${index}`}
              className="aspect-[4/3] animate-pulse rounded-lg bg-gray-200 dark:bg-gray-700"
            />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className={className}>
      <div className="mb-4">
        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">Choose a Theme</h3>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
          Select a preset theme to customize the appearance of InfiniStar.
        </p>
      </div>

      <div
        className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4"
        role="radiogroup"
        aria-label="Theme selection"
      >
        {presetThemes.map((theme) => (
          <ThemePreview
            key={theme.id}
            theme={theme}
            isSelected={currentTheme.id === theme.id && !currentTheme.isCustom}
            onClick={() => setTheme(theme.id)}
          />
        ))}
      </div>
    </div>
  )
}
