"use client"

import * as React from "react"
import { useTheme } from "next-themes"
import { HiComputerDesktop, HiMoon, HiSun } from "react-icons/hi2"

import { cn } from "@/app/lib/utils"

interface DarkModeToggleProps {
  className?: string
}

type ThemeOption = "light" | "dark" | "system"

const themeOptions: { value: ThemeOption; label: string; icon: React.ReactNode }[] = [
  { value: "light", label: "Light", icon: <HiSun className="size-5" aria-hidden="true" /> },
  { value: "dark", label: "Dark", icon: <HiMoon className="size-5" aria-hidden="true" /> },
  {
    value: "system",
    label: "System",
    icon: <HiComputerDesktop className="size-5" aria-hidden="true" />,
  },
]

export function DarkModeToggle({ className }: DarkModeToggleProps) {
  const { theme, setTheme, systemTheme } = useTheme()
  const [mounted, setMounted] = React.useState(false)

  // Avoid hydration mismatch
  React.useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return (
      <div className={cn("space-y-3", className)}>
        <div>
          <span className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Color Mode
          </span>
          <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
            Choose between light, dark, or system preference
          </p>
        </div>
        <div className="flex gap-2">
          {themeOptions.map((option) => (
            <div
              key={option.value}
              className="flex flex-1 animate-pulse flex-col items-center gap-1 rounded-lg border-2 border-gray-200 bg-gray-100 px-4 py-3 dark:border-gray-700 dark:bg-gray-800"
            >
              <div className="size-5 rounded bg-gray-300 dark:bg-gray-600" />
              <div className="h-3 w-10 rounded bg-gray-300 dark:bg-gray-600" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  const currentTheme = theme || "system"

  return (
    <div className={cn("space-y-3", className)}>
      <div>
        <span className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          Color Mode
        </span>
        <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
          Choose between light, dark, or system preference
          {theme === "system" && systemTheme && (
            <span className="ml-1">(currently {systemTheme})</span>
          )}
        </p>
      </div>

      <div className="flex gap-2" role="radiogroup" aria-label="Color mode selection">
        {themeOptions.map((option) => (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={currentTheme === option.value}
            onClick={() => setTheme(option.value)}
            className={cn(
              "flex flex-1 flex-col items-center gap-1 rounded-lg border-2 px-4 py-3 transition-all",
              currentTheme === option.value
                ? "border-sky-500 bg-sky-50 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300"
                : "border-gray-200 bg-white text-gray-600 hover:border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:border-gray-600"
            )}
          >
            {option.icon}
            <span className="text-xs font-medium">{option.label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
