"use client"

import * as React from "react"
import { useTheme } from "next-themes"
import { HiCheck } from "react-icons/hi2"

import type { Theme } from "@/app/lib/themes"
import { cn } from "@/app/lib/utils"

interface ThemePreviewProps {
  theme: Theme
  isSelected: boolean
  onClick: () => void
}

export function ThemePreview({ theme, isSelected, onClick }: ThemePreviewProps) {
  const { resolvedTheme } = useTheme()
  const mode = resolvedTheme === "dark" ? "dark" : "light"
  const colors = theme.colors[mode]
  const chatBubbles = theme.chatBubbles[mode]

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "relative flex flex-col overflow-hidden rounded-lg border-2 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2",
        isSelected
          ? "border-sky-500 ring-2 ring-sky-500 ring-offset-2"
          : "border-gray-200 hover:border-gray-300 dark:border-gray-700 dark:hover:border-gray-600"
      )}
      aria-pressed={isSelected}
      aria-label={`Select ${theme.name} theme`}
    >
      {/* Theme preview card */}
      <div
        className="relative aspect-[4/3] w-full p-3"
        style={{ backgroundColor: `hsl(${colors.background})` }}
      >
        {/* Mini header */}
        <div
          className="mb-2 flex items-center gap-2 rounded-md px-2 py-1"
          style={{ backgroundColor: `hsl(${colors.card})` }}
        >
          <div
            className="size-3 rounded-full"
            style={{ backgroundColor: `hsl(${colors.primary})` }}
          />
          <div className="h-2 w-16 rounded" style={{ backgroundColor: `hsl(${colors.muted})` }} />
        </div>

        {/* Chat preview */}
        <div className="space-y-2">
          {/* AI message */}
          <div className="flex justify-start">
            <div
              className="max-w-[70%] rounded-lg px-2 py-1"
              style={{
                backgroundColor: `hsl(${chatBubbles.aiBubble})`,
                color: `hsl(${chatBubbles.aiBubbleForeground})`,
              }}
            >
              <div
                className="h-1.5 w-12 rounded"
                style={{
                  backgroundColor: `hsl(${chatBubbles.aiBubbleForeground})`,
                  opacity: 0.6,
                }}
              />
            </div>
          </div>
          {/* User message */}
          <div className="flex justify-end">
            <div
              className="max-w-[70%] rounded-lg px-2 py-1"
              style={{
                backgroundColor: `hsl(${chatBubbles.userBubble})`,
                color: `hsl(${chatBubbles.userBubbleForeground})`,
              }}
            >
              <div
                className="h-1.5 w-10 rounded"
                style={{
                  backgroundColor: `hsl(${chatBubbles.userBubbleForeground})`,
                  opacity: 0.6,
                }}
              />
            </div>
          </div>
          {/* AI message */}
          <div className="flex justify-start">
            <div
              className="max-w-[70%] rounded-lg px-2 py-1"
              style={{
                backgroundColor: `hsl(${chatBubbles.aiBubble})`,
                color: `hsl(${chatBubbles.aiBubbleForeground})`,
              }}
            >
              <div
                className="h-1.5 w-14 rounded"
                style={{
                  backgroundColor: `hsl(${chatBubbles.aiBubbleForeground})`,
                  opacity: 0.6,
                }}
              />
            </div>
          </div>
        </div>

        {/* Selection indicator */}
        {isSelected && (
          <div className="absolute right-2 top-2 flex size-5 items-center justify-center rounded-full bg-sky-500 text-white">
            <HiCheck className="size-3" aria-hidden="true" />
          </div>
        )}
      </div>

      {/* Theme info */}
      <div className="px-3 py-2" style={{ backgroundColor: `hsl(${colors.card})` }}>
        <p className="text-sm font-medium" style={{ color: `hsl(${colors.foreground})` }}>
          {theme.name}
        </p>
        <p className="text-xs" style={{ color: `hsl(${colors.mutedForeground})` }}>
          {theme.description}
        </p>
      </div>
    </button>
  )
}
