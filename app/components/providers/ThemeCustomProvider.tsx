"use client"

import * as React from "react"
import { useTheme } from "next-themes"

import {
  getDefaultTheme,
  getThemeById,
  loadThemePreference,
  mergeTheme,
  presetThemes,
  saveThemePreference,
  themeToCssVariables,
  type Theme,
  type UserThemePreference,
} from "@/app/lib/themes"

interface ThemeCustomContextValue {
  // Current active theme
  currentTheme: Theme
  // All available preset themes
  presetThemes: Theme[]
  // User's theme preference
  preference: UserThemePreference
  // Set theme by ID
  setTheme: (themeId: string) => void
  // Set custom theme overrides
  setCustomTheme: (overrides: Partial<Theme>) => void
  // Reset to default theme
  resetToDefault: () => void
  // Export current theme as JSON
  exportTheme: () => string
  // Import theme from JSON
  importTheme: (json: string) => boolean
  // Whether theme is loading
  isLoading: boolean
}

const ThemeCustomContext = React.createContext<ThemeCustomContextValue | undefined>(undefined)

/**
 * The resolved CSS variables of a non-default theme, for both modes, so the
 * inline script below can paint them before hydration. Without it a custom
 * theme flashed the default palette on every dashboard load until the mount
 * effect ran. Versioned: bump the suffix if the stored shape changes.
 */
const THEME_CSS_CACHE_KEY = "infinistar-theme-css:v1"

// Runs synchronously while the HTML is parsed, after next-themes has set the
// `dark` class on <html>, and before any dashboard content paints.
const APPLY_CACHED_THEME_SCRIPT = `(function(){try{var c=localStorage.getItem(${JSON.stringify(
  THEME_CSS_CACHE_KEY
)});if(!c)return;var v=JSON.parse(c);var r=document.documentElement;var m=r.classList.contains("dark")?"dark":"light";var s=v&&v[m];if(!s)return;for(var k in s){r.style.setProperty(k,s[k])}}catch(e){}})()`

function writeThemeCssCache(theme: Theme): void {
  try {
    if (theme.id === getDefaultTheme().id && !theme.isCustom) {
      // The default palette is already in globals.css; nothing to pre-paint.
      localStorage.removeItem(THEME_CSS_CACHE_KEY)
      return
    }
    localStorage.setItem(
      THEME_CSS_CACHE_KEY,
      JSON.stringify({
        light: themeToCssVariables(theme, "light"),
        dark: themeToCssVariables(theme, "dark"),
      })
    )
  } catch {
    // Storage unavailable: the theme still applies after mount, as before.
  }
}

type IdleHandle = { cancel: () => void }

function scheduleIdle(callback: () => void): IdleHandle {
  if (typeof window.requestIdleCallback === "function") {
    const id = window.requestIdleCallback(callback, { timeout: 2000 })
    return { cancel: () => window.cancelIdleCallback(id) }
  }
  const id = window.setTimeout(callback, 1)
  return { cancel: () => window.clearTimeout(id) }
}

export function useThemeCustom() {
  const context = React.useContext(ThemeCustomContext)
  if (context === undefined) {
    throw new Error("useThemeCustom must be used within a ThemeCustomProvider")
  }
  return context
}

interface ThemeCustomProviderProps {
  children: React.ReactNode
  defaultThemeId?: string
}

export function ThemeCustomProvider({
  children,
  defaultThemeId = "default",
}: ThemeCustomProviderProps) {
  const { resolvedTheme } = useTheme()
  const [isLoading, setIsLoading] = React.useState(true)
  const [preference, setPreference] = React.useState<UserThemePreference>({
    themeId: defaultThemeId,
  })
  const [currentTheme, setCurrentTheme] = React.useState<Theme>(getDefaultTheme)

  // Load theme preference from localStorage on mount
  React.useEffect(() => {
    const stored = loadThemePreference()
    if (stored) {
      setPreference(stored)
      const baseTheme = getThemeById(stored.themeId) || getDefaultTheme()
      if (stored.customTheme) {
        setCurrentTheme(mergeTheme(baseTheme, stored.customTheme))
      } else {
        setCurrentTheme(baseTheme)
      }
    }
    setIsLoading(false)
  }, [])

  // Apply CSS variables when theme or mode changes
  React.useEffect(() => {
    if (isLoading || typeof window === "undefined") return

    const mode = resolvedTheme === "dark" ? "dark" : "light"
    const cssVars = themeToCssVariables(currentTheme, mode)

    // Apply CSS variables to document root
    const root = document.documentElement
    Object.entries(cssVars).forEach(([key, value]) => {
      root.style.setProperty(key, value)
    })

    // Check for reduced motion preference
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)")
    if (prefersReducedMotion.matches) {
      root.style.setProperty("--theme-transition-duration", "0ms")
    } else {
      root.style.setProperty("--theme-transition-duration", "200ms")
    }

    // Cache for the pre-paint script off the critical path; dragging a color
    // picker fires this effect many times a second.
    const idle = scheduleIdle(() => writeThemeCssCache(currentTheme))

    return () => idle.cancel()
  }, [currentTheme, resolvedTheme, isLoading])

  // Set theme by ID
  const setThemeById = React.useCallback((themeId: string) => {
    const theme = getThemeById(themeId) || getDefaultTheme()
    const newPreference: UserThemePreference = {
      themeId,
      customTheme: undefined,
    }
    setPreference(newPreference)
    setCurrentTheme(theme)
    saveThemePreference(newPreference)
  }, [])

  // Set custom theme overrides
  const setCustomTheme = React.useCallback(
    (overrides: Partial<Theme>) => {
      const baseTheme = getThemeById(preference.themeId) || getDefaultTheme()
      const merged = mergeTheme(baseTheme, overrides)
      const newPreference: UserThemePreference = {
        themeId: preference.themeId,
        customTheme: overrides,
      }
      setPreference(newPreference)
      setCurrentTheme(merged)
      saveThemePreference(newPreference)
    },
    [preference.themeId]
  )

  // Reset to default theme
  const resetToDefault = React.useCallback(() => {
    const defaultTheme = getDefaultTheme()
    const newPreference: UserThemePreference = {
      themeId: "default",
    }
    setPreference(newPreference)
    setCurrentTheme(defaultTheme)
    saveThemePreference(newPreference)
  }, [])

  // Export current theme as JSON
  const exportThemeJson = React.useCallback(() => {
    return JSON.stringify(currentTheme, null, 2)
  }, [currentTheme])

  // Import theme from JSON
  const importThemeJson = React.useCallback((json: string): boolean => {
    try {
      const imported = JSON.parse(json) as Theme
      // Validate required fields
      if (!imported.id || !imported.name || !imported.colors || !imported.chatBubbles) {
        return false
      }
      const customTheme: Theme = {
        ...imported,
        id: `custom-${Date.now()}`,
        isCustom: true,
      }
      const newPreference: UserThemePreference = {
        themeId: "default", // Base on default
        customTheme,
      }
      setPreference(newPreference)
      setCurrentTheme(customTheme)
      saveThemePreference(newPreference)
      return true
    } catch {
      return false
    }
  }, [])

  const value = React.useMemo(
    () => ({
      currentTheme,
      presetThemes,
      preference,
      setTheme: setThemeById,
      setCustomTheme,
      resetToDefault,
      exportTheme: exportThemeJson,
      importTheme: importThemeJson,
      isLoading,
    }),
    [
      currentTheme,
      preference,
      setThemeById,
      setCustomTheme,
      resetToDefault,
      exportThemeJson,
      importThemeJson,
      isLoading,
    ]
  )

  return (
    <>
      <script
        // Static string, no user input: applies the cached custom palette pre-paint.
        dangerouslySetInnerHTML={{ __html: APPLY_CACHED_THEME_SCRIPT }}
        suppressHydrationWarning
      />
      <ThemeCustomContext.Provider value={value}>{children}</ThemeCustomContext.Provider>
    </>
  )
}
