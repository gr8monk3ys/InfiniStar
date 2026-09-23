"use client"

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
          <Icons.sun
            className="size-5 rotate-0 scale-100 transition-transform dark:-rotate-90 dark:scale-0"
            aria-hidden="true"
          />
          <Icons.moon
            className="absolute size-5 rotate-90 scale-0 transition-transform dark:rotate-0 dark:scale-100"
            aria-hidden="true"
          />
          <span className="sr-only">Toggle theme</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem
          onClick={() => setTheme("light")}
          className={theme === "light" ? "bg-accent" : ""}
        >
          <Icons.sun className="mr-2 size-4" aria-hidden="true" />
          <span>Light</span>
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => setTheme("dark")}
          className={theme === "dark" ? "bg-accent" : ""}
        >
          <Icons.moon className="mr-2 size-4" aria-hidden="true" />
          <span>Dark</span>
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => setTheme("system")}
          className={theme === "system" ? "bg-accent" : ""}
        >
          <Icons.laptop className="mr-2 size-4" aria-hidden="true" />
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

  // Read at click time, after hydration, when resolvedTheme is always known.
  const toggleTheme = () => {
    setTheme(resolvedTheme === "dark" ? "light" : "dark")
  }

  // The icon and label follow the `dark` class that next-themes sets on <html>
  // before first paint, so the server HTML is already right for either theme:
  // no mounted flag, no post-hydration swap, no hydration mismatch.
  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="cursor-pointer rounded-full p-2 text-primary transition hover:bg-accent hover:text-primary/80"
      title="Toggle theme"
    >
      <Icons.sun className="size-5 dark:hidden" aria-hidden="true" />
      <Icons.moon className="hidden size-5 dark:block" aria-hidden="true" />
      <span className="sr-only dark:hidden">Switch to dark theme</span>
      <span className="sr-only hidden dark:inline">Switch to light theme</span>
    </button>
  )
}
