"use client"

import * as React from "react"
import { useTheme } from "next-themes"

import { Button } from "@/app/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/app/components/ui/dropdown-menu"
import { Icons } from "@/app/components/icons"

export function ThemeToggle() {
  const { setTheme, theme } = useTheme()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" aria-label="Toggle theme">
          <Icons.sun className="size-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Icons.moon className="absolute size-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          <span className="sr-only">Toggle theme</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem
          onClick={() => setTheme("light")}
          className={theme === "light" ? "bg-accent" : ""}
        >
          <Icons.sun className="mr-2 size-4" />
          <span>Light</span>
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => setTheme("dark")}
          className={theme === "dark" ? "bg-accent" : ""}
        >
          <Icons.moon className="mr-2 size-4" />
          <span>Dark</span>
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => setTheme("system")}
          className={theme === "system" ? "bg-accent" : ""}
        >
          <Icons.laptop className="mr-2 size-4" />
          <span>System</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/**
 * A simpler theme toggle button for compact spaces. Flips between the
 * resolved light and dark themes; there is no "system" step, so every click
 * visibly changes the page.
 */
export function ThemeToggleCompact() {
  const { setTheme, resolvedTheme } = useTheme()
  const [mounted, setMounted] = React.useState(false)

  // Avoid hydration mismatch by only rendering after mount
  React.useEffect(() => {
    setMounted(true)
  }, [])

  const isDark = resolvedTheme === "dark"

  const toggleTheme = () => {
    setTheme(isDark ? "light" : "dark")
  }

  const getIcon = () => {
    if (!mounted) {
      // Return a placeholder during SSR to avoid hydration mismatch
      return <Icons.sun className="size-5" />
    }

    return isDark ? <Icons.moon className="size-5" /> : <Icons.sun className="size-5" />
  }

  const getLabel = () => {
    if (!mounted) return "Toggle theme"
    return isDark ? "Switch to light theme" : "Switch to dark theme"
  }

  return (
    <button
      onClick={toggleTheme}
      className="cursor-pointer rounded-full p-2 text-primary transition hover:bg-accent hover:text-primary/80"
      title={getLabel()}
      aria-label={getLabel()}
    >
      {getIcon()}
    </button>
  )
}
