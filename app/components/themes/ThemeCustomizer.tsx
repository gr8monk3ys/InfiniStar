"use client"

import * as React from "react"
import { useTheme } from "next-themes"
import toast from "react-hot-toast"
import { HiArrowDownTray, HiArrowPath, HiArrowUpTray } from "react-icons/hi2"

import type { BorderRadius, Density, FontFamily } from "@/app/lib/themes"
import { useThemeCustom } from "@/app/components/providers/ThemeCustomProvider"

import { BorderRadiusSelector } from "./BorderRadiusSelector"
import { ColorPicker } from "./ColorPicker"
import { DensitySelector } from "./DensitySelector"
import { FontSelector } from "./FontSelector"

interface ThemeCustomizerProps {
  className?: string
}

export function ThemeCustomizer({ className }: ThemeCustomizerProps) {
  const { resolvedTheme } = useTheme()
  const { currentTheme, setCustomTheme, resetToDefault, exportTheme, importTheme, isLoading } =
    useThemeCustom()
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  const mode = resolvedTheme === "dark" ? "dark" : "light"
  const colors = currentTheme.colors[mode]
  const chatBubbles = currentTheme.chatBubbles[mode]

  // Update a single color
  const updateColor = (key: string, value: string) => {
    const newColors = {
      ...currentTheme.colors,
      [mode]: {
        ...colors,
        [key]: value,
      },
    }
    setCustomTheme({ colors: newColors })
  }

  // Update chat bubble color
  const updateChatBubble = (key: string, value: string) => {
    const newChatBubbles = {
      ...currentTheme.chatBubbles,
      [mode]: {
        ...chatBubbles,
        [key]: value,
      },
    }
    setCustomTheme({ chatBubbles: newChatBubbles })
  }

  // Update font
  const updateFont = (type: "headingFont" | "bodyFont", value: FontFamily) => {
    setCustomTheme({ [type]: value })
  }

  // Update border radius
  const updateBorderRadius = (value: BorderRadius) => {
    setCustomTheme({ borderRadius: value })
  }

  // Update density
  const updateDensity = (value: Density) => {
    setCustomTheme({ density: value })
  }

  // Handle export
  const handleExport = () => {
    const json = exportTheme()
    const blob = new Blob([json], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `infinistar-theme-${currentTheme.id}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    toast.success("Theme exported successfully")
  }

  // Handle import
  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      const json = event.target?.result as string
      if (importTheme(json)) {
        toast.success("Theme imported successfully")
      } else {
        toast.error("Invalid theme file")
      }
    }
    reader.onerror = () => {
      toast.error("Failed to read file")
    }
    reader.readAsText(file)

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  // Handle reset
  const handleReset = () => {
    resetToDefault()
    toast.success("Theme reset to default")
  }

  if (isLoading) {
    return (
      <div className={className}>
        <div className="animate-pulse space-y-4">
          <div className="h-6 w-32 rounded bg-gray-200 dark:bg-gray-700" />
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, index) => (
              // eslint-disable-next-line react/no-array-index-key -- Static skeleton placeholders
              <div
                key={`skeleton-customizer-${index}`}
                className="h-10 rounded bg-gray-200 dark:bg-gray-700"
              />
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={className}>
      <div className="mb-6">
        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">Customize Theme</h3>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
          Fine-tune your selected theme with custom colors, fonts, and spacing. Changes are saved
          automatically.
        </p>
      </div>

      <div className="space-y-8">
        {/* Core Colors Section */}
        <section>
          <h4 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
            Core Colors
          </h4>
          <div className="space-y-4 rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
            <ColorPicker
              id="primary"
              label="Primary Color"
              description="Main brand color for buttons and links"
              value={colors.primary}
              onChange={(v) => updateColor("primary", v)}
            />
            <ColorPicker
              id="secondary"
              label="Secondary Color"
              description="Supporting color for secondary actions"
              value={colors.secondary}
              onChange={(v) => updateColor("secondary", v)}
            />
            <ColorPicker
              id="accent"
              label="Accent Color"
              description="Highlights and accents"
              value={colors.accent}
              onChange={(v) => updateColor("accent", v)}
            />
            <ColorPicker
              id="background"
              label="Background"
              description="Page background color"
              value={colors.background}
              onChange={(v) => updateColor("background", v)}
            />
            <ColorPicker
              id="foreground"
              label="Foreground"
              description="Main text color"
              value={colors.foreground}
              onChange={(v) => updateColor("foreground", v)}
            />
          </div>
        </section>

        {/* Chat Bubble Colors Section */}
        <section>
          <h4 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
            Chat Bubbles
          </h4>
          <div className="space-y-4 rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
            <ColorPicker
              id="userBubble"
              label="Your Message Bubble"
              description="Background color for your messages"
              value={chatBubbles.userBubble}
              onChange={(v) => updateChatBubble("userBubble", v)}
            />
            <ColorPicker
              id="userBubbleForeground"
              label="Your Message Text"
              description="Text color for your messages"
              value={chatBubbles.userBubbleForeground}
              onChange={(v) => updateChatBubble("userBubbleForeground", v)}
            />
            <ColorPicker
              id="aiBubble"
              label="AI Message Bubble"
              description="Background color for AI messages"
              value={chatBubbles.aiBubble}
              onChange={(v) => updateChatBubble("aiBubble", v)}
            />
            <ColorPicker
              id="aiBubbleForeground"
              label="AI Message Text"
              description="Text color for AI messages"
              value={chatBubbles.aiBubbleForeground}
              onChange={(v) => updateChatBubble("aiBubbleForeground", v)}
            />
          </div>
        </section>

        {/* Typography Section */}
        <section>
          <h4 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
            Typography
          </h4>
          <div className="space-y-6 rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
            <FontSelector
              id="headingFont"
              label="Heading Font"
              description="Font family for headings and titles"
              value={currentTheme.headingFont}
              onChange={(v) => updateFont("headingFont", v)}
            />
            <FontSelector
              id="bodyFont"
              label="Body Font"
              description="Font family for body text"
              value={currentTheme.bodyFont}
              onChange={(v) => updateFont("bodyFont", v)}
            />
          </div>
        </section>

        {/* Layout Section */}
        <section>
          <h4 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
            Layout
          </h4>
          <div className="space-y-6 rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
            <BorderRadiusSelector
              label="Border Radius"
              description="Roundedness of corners for buttons, cards, and inputs"
              value={currentTheme.borderRadius}
              onChange={updateBorderRadius}
            />
            <DensitySelector
              label="Density"
              description="Spacing and padding throughout the interface"
              value={currentTheme.density}
              onChange={updateDensity}
            />
          </div>
        </section>

        {/* Import/Export Section */}
        <section>
          <h4 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
            Import / Export
          </h4>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handleExport}
              className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
            >
              <HiArrowDownTray className="size-4" aria-hidden="true" />
              Export Theme
            </button>
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700">
              <HiArrowUpTray className="size-4" aria-hidden="true" />
              Import Theme
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                onChange={handleImport}
                className="sr-only"
              />
            </label>
            <button
              type="button"
              onClick={handleReset}
              className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
            >
              <HiArrowPath className="size-4" aria-hidden="true" />
              Reset to Default
            </button>
          </div>
        </section>
      </div>
    </div>
  )
}
