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
          <span className="block text-sm font-medium text-foreground">Color Mode</span>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Choose between light, dark, or system preference
          </p>
        </div>
        <div className="flex gap-2">
          {themeOptions.map((option) => (
            <div
              key={option.value}
              className="flex flex-1 animate-pulse flex-col items-center gap-1 rounded-lg border-2 border-border bg-muted px-4 py-3"
            >
              <div className="size-5 rounded bg-border" />
              <div className="h-3 w-10 rounded bg-border" />
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
        <span className="block text-sm font-medium text-foreground">Color Mode</span>
        <p className="mt-0.5 text-xs text-muted-foreground">
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
                ? "border-primary bg-primary/10 text-primary"
                : "border-border bg-card text-muted-foreground hover:border-primary/30"
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
