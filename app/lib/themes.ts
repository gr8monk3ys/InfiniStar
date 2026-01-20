/**
 * Theme system for InfiniStar
 * Defines theme interfaces, preset themes, and utility functions
 */

export type BorderRadius = "none" | "small" | "medium" | "large" | "full"
export type Density = "compact" | "comfortable" | "spacious"
export type FontFamily =
  | "system"
  | "inter"
  | "roboto"
  | "open-sans"
  | "lato"
  | "poppins"
  | "source-sans"
  | "nunito"

export interface ThemeColors {
  // Core colors (HSL format without hsl() wrapper, e.g., "222.2 47.4% 11.2%")
  primary: string
  primaryForeground: string
  secondary: string
  secondaryForeground: string
  accent: string
  accentForeground: string
  background: string
  foreground: string
  muted: string
  mutedForeground: string
  border: string
  input: string
  ring: string
  card: string
  cardForeground: string
  popover: string
  popoverForeground: string
  destructive: string
  destructiveForeground: string
}

export interface ChatBubbleColors {
  userBubble: string
  userBubbleForeground: string
  aiBubble: string
  aiBubbleForeground: string
}

export interface Theme {
  id: string
  name: string
  description: string
  colors: {
    light: ThemeColors
    dark: ThemeColors
  }
  chatBubbles: {
    light: ChatBubbleColors
    dark: ChatBubbleColors
  }
  headingFont: FontFamily
  bodyFont: FontFamily
  borderRadius: BorderRadius
  density: Density
  isCustom?: boolean
}

export interface UserThemePreference {
  themeId: string
  customTheme?: Partial<Theme>
}

// Border radius values mapping
export const borderRadiusValues: Record<BorderRadius, string> = {
  none: "0",
  small: "0.25rem",
  medium: "0.5rem",
  large: "0.75rem",
  full: "1rem",
}

// Density spacing multipliers
export const densitySpacing: Record<Density, { base: number; label: string }> = {
  compact: { base: 0.75, label: "Compact" },
  comfortable: { base: 1, label: "Comfortable" },
  spacious: { base: 1.25, label: "Spacious" },
}

// Font family CSS values
export const fontFamilyValues: Record<FontFamily, string> = {
  system:
    'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  inter: '"Inter", ui-sans-serif, system-ui, sans-serif',
  roboto: '"Roboto", ui-sans-serif, system-ui, sans-serif',
  "open-sans": '"Open Sans", ui-sans-serif, system-ui, sans-serif',
  lato: '"Lato", ui-sans-serif, system-ui, sans-serif',
  poppins: '"Poppins", ui-sans-serif, system-ui, sans-serif',
  "source-sans": '"Source Sans 3", ui-sans-serif, system-ui, sans-serif',
  nunito: '"Nunito", ui-sans-serif, system-ui, sans-serif',
}

export const fontFamilyLabels: Record<FontFamily, string> = {
  system: "System Default",
  inter: "Inter",
  roboto: "Roboto",
  "open-sans": "Open Sans",
  lato: "Lato",
  poppins: "Poppins",
  "source-sans": "Source Sans",
  nunito: "Nunito",
}

// Preset Themes
export const presetThemes: Theme[] = [
  {
    id: "default",
    name: "Default",
    description: "Clean and modern blue theme",
    colors: {
      light: {
        background: "0 0% 100%",
        foreground: "222.2 47.4% 11.2%",
        muted: "210 40% 96.1%",
        mutedForeground: "215.4 16.3% 46.9%",
        popover: "0 0% 100%",
        popoverForeground: "222.2 47.4% 11.2%",
        border: "214.3 31.8% 91.4%",
        input: "214.3 31.8% 91.4%",
        card: "0 0% 100%",
        cardForeground: "222.2 47.4% 11.2%",
        primary: "221.2 83.2% 53.3%",
        primaryForeground: "210 40% 98%",
        secondary: "210 40% 96.1%",
        secondaryForeground: "222.2 47.4% 11.2%",
        accent: "210 40% 96.1%",
        accentForeground: "222.2 47.4% 11.2%",
        destructive: "0 84.2% 60.2%",
        destructiveForeground: "210 40% 98%",
        ring: "221.2 83.2% 53.3%",
      },
      dark: {
        background: "224 71% 4%",
        foreground: "213 31% 91%",
        muted: "223 47% 11%",
        mutedForeground: "215.4 16.3% 56.9%",
        popover: "224 71% 4%",
        popoverForeground: "215 20.2% 65.1%",
        border: "216 34% 17%",
        input: "216 34% 17%",
        card: "224 71% 4%",
        cardForeground: "213 31% 91%",
        primary: "217.2 91.2% 59.8%",
        primaryForeground: "222.2 47.4% 11.2%",
        secondary: "222.2 47.4% 11.2%",
        secondaryForeground: "210 40% 98%",
        accent: "216 34% 17%",
        accentForeground: "210 40% 98%",
        destructive: "0 62.8% 30.6%",
        destructiveForeground: "210 40% 98%",
        ring: "217.2 91.2% 59.8%",
      },
    },
    chatBubbles: {
      light: {
        userBubble: "221.2 83.2% 53.3%",
        userBubbleForeground: "0 0% 100%",
        aiBubble: "210 40% 96.1%",
        aiBubbleForeground: "222.2 47.4% 11.2%",
      },
      dark: {
        userBubble: "217.2 91.2% 59.8%",
        userBubbleForeground: "0 0% 100%",
        aiBubble: "223 47% 11%",
        aiBubbleForeground: "213 31% 91%",
      },
    },
    headingFont: "inter",
    bodyFont: "inter",
    borderRadius: "medium",
    density: "comfortable",
  },
  {
    id: "ocean",
    name: "Ocean",
    description: "Deep blues and teals inspired by the sea",
    colors: {
      light: {
        background: "185 30% 98%",
        foreground: "200 80% 10%",
        muted: "185 30% 94%",
        mutedForeground: "200 20% 45%",
        popover: "185 30% 98%",
        popoverForeground: "200 80% 10%",
        border: "185 30% 88%",
        input: "185 30% 88%",
        card: "185 30% 99%",
        cardForeground: "200 80% 10%",
        primary: "192 91% 36%",
        primaryForeground: "0 0% 100%",
        secondary: "185 40% 92%",
        secondaryForeground: "200 80% 15%",
        accent: "174 72% 40%",
        accentForeground: "0 0% 100%",
        destructive: "0 84.2% 60.2%",
        destructiveForeground: "210 40% 98%",
        ring: "192 91% 36%",
      },
      dark: {
        background: "200 50% 6%",
        foreground: "185 30% 92%",
        muted: "200 40% 12%",
        mutedForeground: "185 20% 55%",
        popover: "200 50% 6%",
        popoverForeground: "185 30% 85%",
        border: "200 40% 18%",
        input: "200 40% 18%",
        card: "200 45% 8%",
        cardForeground: "185 30% 92%",
        primary: "192 76% 45%",
        primaryForeground: "0 0% 100%",
        secondary: "200 40% 15%",
        secondaryForeground: "185 30% 92%",
        accent: "174 62% 35%",
        accentForeground: "0 0% 100%",
        destructive: "0 62.8% 30.6%",
        destructiveForeground: "210 40% 98%",
        ring: "192 76% 45%",
      },
    },
    chatBubbles: {
      light: {
        userBubble: "192 91% 36%",
        userBubbleForeground: "0 0% 100%",
        aiBubble: "185 40% 92%",
        aiBubbleForeground: "200 80% 10%",
      },
      dark: {
        userBubble: "192 76% 45%",
        userBubbleForeground: "0 0% 100%",
        aiBubble: "200 40% 15%",
        aiBubbleForeground: "185 30% 92%",
      },
    },
    headingFont: "poppins",
    bodyFont: "inter",
    borderRadius: "large",
    density: "comfortable",
  },
  {
    id: "forest",
    name: "Forest",
    description: "Natural greens and earth tones",
    colors: {
      light: {
        background: "80 30% 98%",
        foreground: "120 30% 12%",
        muted: "80 25% 93%",
        mutedForeground: "100 15% 45%",
        popover: "80 30% 98%",
        popoverForeground: "120 30% 12%",
        border: "80 25% 87%",
        input: "80 25% 87%",
        card: "80 30% 99%",
        cardForeground: "120 30% 12%",
        primary: "142 72% 29%",
        primaryForeground: "0 0% 100%",
        secondary: "80 30% 91%",
        secondaryForeground: "120 30% 15%",
        accent: "30 60% 45%",
        accentForeground: "0 0% 100%",
        destructive: "0 84.2% 60.2%",
        destructiveForeground: "210 40% 98%",
        ring: "142 72% 29%",
      },
      dark: {
        background: "120 25% 6%",
        foreground: "80 25% 90%",
        muted: "120 20% 12%",
        mutedForeground: "80 15% 55%",
        popover: "120 25% 6%",
        popoverForeground: "80 25% 82%",
        border: "120 20% 18%",
        input: "120 20% 18%",
        card: "120 22% 8%",
        cardForeground: "80 25% 90%",
        primary: "142 62% 39%",
        primaryForeground: "0 0% 100%",
        secondary: "120 20% 15%",
        secondaryForeground: "80 25% 90%",
        accent: "30 50% 40%",
        accentForeground: "0 0% 100%",
        destructive: "0 62.8% 30.6%",
        destructiveForeground: "210 40% 98%",
        ring: "142 62% 39%",
      },
    },
    chatBubbles: {
      light: {
        userBubble: "142 72% 29%",
        userBubbleForeground: "0 0% 100%",
        aiBubble: "80 30% 91%",
        aiBubbleForeground: "120 30% 12%",
      },
      dark: {
        userBubble: "142 62% 39%",
        userBubbleForeground: "0 0% 100%",
        aiBubble: "120 20% 15%",
        aiBubbleForeground: "80 25% 90%",
      },
    },
    headingFont: "lato",
    bodyFont: "open-sans",
    borderRadius: "medium",
    density: "comfortable",
  },
  {
    id: "sunset",
    name: "Sunset",
    description: "Warm oranges and reds",
    colors: {
      light: {
        background: "30 40% 98%",
        foreground: "15 60% 12%",
        muted: "30 35% 93%",
        mutedForeground: "20 25% 45%",
        popover: "30 40% 98%",
        popoverForeground: "15 60% 12%",
        border: "30 35% 87%",
        input: "30 35% 87%",
        card: "30 40% 99%",
        cardForeground: "15 60% 12%",
        primary: "24 95% 53%",
        primaryForeground: "0 0% 100%",
        secondary: "30 40% 91%",
        secondaryForeground: "15 60% 15%",
        accent: "350 80% 55%",
        accentForeground: "0 0% 100%",
        destructive: "0 84.2% 60.2%",
        destructiveForeground: "210 40% 98%",
        ring: "24 95% 53%",
      },
      dark: {
        background: "15 35% 6%",
        foreground: "30 35% 90%",
        muted: "15 30% 12%",
        mutedForeground: "30 20% 55%",
        popover: "15 35% 6%",
        popoverForeground: "30 35% 82%",
        border: "15 30% 18%",
        input: "15 30% 18%",
        card: "15 32% 8%",
        cardForeground: "30 35% 90%",
        primary: "24 90% 50%",
        primaryForeground: "0 0% 100%",
        secondary: "15 30% 15%",
        secondaryForeground: "30 35% 90%",
        accent: "350 70% 50%",
        accentForeground: "0 0% 100%",
        destructive: "0 62.8% 30.6%",
        destructiveForeground: "210 40% 98%",
        ring: "24 90% 50%",
      },
    },
    chatBubbles: {
      light: {
        userBubble: "24 95% 53%",
        userBubbleForeground: "0 0% 100%",
        aiBubble: "30 40% 91%",
        aiBubbleForeground: "15 60% 12%",
      },
      dark: {
        userBubble: "24 90% 50%",
        userBubbleForeground: "0 0% 100%",
        aiBubble: "15 30% 15%",
        aiBubbleForeground: "30 35% 90%",
      },
    },
    headingFont: "poppins",
    bodyFont: "nunito",
    borderRadius: "large",
    density: "comfortable",
  },
  {
    id: "midnight",
    name: "Midnight",
    description: "Deep purple and blue night theme",
    colors: {
      light: {
        background: "250 30% 98%",
        foreground: "260 50% 12%",
        muted: "250 25% 93%",
        mutedForeground: "260 20% 45%",
        popover: "250 30% 98%",
        popoverForeground: "260 50% 12%",
        border: "250 25% 87%",
        input: "250 25% 87%",
        card: "250 30% 99%",
        cardForeground: "260 50% 12%",
        primary: "258 90% 55%",
        primaryForeground: "0 0% 100%",
        secondary: "250 30% 91%",
        secondaryForeground: "260 50% 15%",
        accent: "230 80% 55%",
        accentForeground: "0 0% 100%",
        destructive: "0 84.2% 60.2%",
        destructiveForeground: "210 40% 98%",
        ring: "258 90% 55%",
      },
      dark: {
        background: "260 45% 5%",
        foreground: "250 25% 90%",
        muted: "260 35% 10%",
        mutedForeground: "250 15% 55%",
        popover: "260 45% 5%",
        popoverForeground: "250 25% 82%",
        border: "260 35% 16%",
        input: "260 35% 16%",
        card: "260 40% 7%",
        cardForeground: "250 25% 90%",
        primary: "258 80% 60%",
        primaryForeground: "0 0% 100%",
        secondary: "260 35% 13%",
        secondaryForeground: "250 25% 90%",
        accent: "230 70% 50%",
        accentForeground: "0 0% 100%",
        destructive: "0 62.8% 30.6%",
        destructiveForeground: "210 40% 98%",
        ring: "258 80% 60%",
      },
    },
    chatBubbles: {
      light: {
        userBubble: "258 90% 55%",
        userBubbleForeground: "0 0% 100%",
        aiBubble: "250 30% 91%",
        aiBubbleForeground: "260 50% 12%",
      },
      dark: {
        userBubble: "258 80% 60%",
        userBubbleForeground: "0 0% 100%",
        aiBubble: "260 35% 13%",
        aiBubbleForeground: "250 25% 90%",
      },
    },
    headingFont: "source-sans",
    bodyFont: "inter",
    borderRadius: "medium",
    density: "comfortable",
  },
  {
    id: "lavender",
    name: "Lavender",
    description: "Soft purples and pinks",
    colors: {
      light: {
        background: "280 30% 98%",
        foreground: "290 40% 15%",
        muted: "280 25% 93%",
        mutedForeground: "290 15% 45%",
        popover: "280 30% 98%",
        popoverForeground: "290 40% 15%",
        border: "280 25% 88%",
        input: "280 25% 88%",
        card: "280 30% 99%",
        cardForeground: "290 40% 15%",
        primary: "270 60% 60%",
        primaryForeground: "0 0% 100%",
        secondary: "280 30% 92%",
        secondaryForeground: "290 40% 18%",
        accent: "330 60% 65%",
        accentForeground: "0 0% 100%",
        destructive: "0 84.2% 60.2%",
        destructiveForeground: "210 40% 98%",
        ring: "270 60% 60%",
      },
      dark: {
        background: "280 35% 6%",
        foreground: "280 25% 90%",
        muted: "280 30% 11%",
        mutedForeground: "280 15% 55%",
        popover: "280 35% 6%",
        popoverForeground: "280 25% 82%",
        border: "280 30% 17%",
        input: "280 30% 17%",
        card: "280 32% 8%",
        cardForeground: "280 25% 90%",
        primary: "270 55% 55%",
        primaryForeground: "0 0% 100%",
        secondary: "280 30% 14%",
        secondaryForeground: "280 25% 90%",
        accent: "330 55% 55%",
        accentForeground: "0 0% 100%",
        destructive: "0 62.8% 30.6%",
        destructiveForeground: "210 40% 98%",
        ring: "270 55% 55%",
      },
    },
    chatBubbles: {
      light: {
        userBubble: "270 60% 60%",
        userBubbleForeground: "0 0% 100%",
        aiBubble: "280 30% 92%",
        aiBubbleForeground: "290 40% 15%",
      },
      dark: {
        userBubble: "270 55% 55%",
        userBubbleForeground: "0 0% 100%",
        aiBubble: "280 30% 14%",
        aiBubbleForeground: "280 25% 90%",
      },
    },
    headingFont: "nunito",
    bodyFont: "nunito",
    borderRadius: "large",
    density: "spacious",
  },
  {
    id: "monochrome",
    name: "Monochrome",
    description: "Elegant grayscale design",
    colors: {
      light: {
        background: "0 0% 100%",
        foreground: "0 0% 9%",
        muted: "0 0% 96%",
        mutedForeground: "0 0% 45%",
        popover: "0 0% 100%",
        popoverForeground: "0 0% 9%",
        border: "0 0% 90%",
        input: "0 0% 90%",
        card: "0 0% 100%",
        cardForeground: "0 0% 9%",
        primary: "0 0% 15%",
        primaryForeground: "0 0% 100%",
        secondary: "0 0% 94%",
        secondaryForeground: "0 0% 12%",
        accent: "0 0% 88%",
        accentForeground: "0 0% 12%",
        destructive: "0 84.2% 60.2%",
        destructiveForeground: "210 40% 98%",
        ring: "0 0% 15%",
      },
      dark: {
        background: "0 0% 6%",
        foreground: "0 0% 92%",
        muted: "0 0% 12%",
        mutedForeground: "0 0% 55%",
        popover: "0 0% 6%",
        popoverForeground: "0 0% 82%",
        border: "0 0% 18%",
        input: "0 0% 18%",
        card: "0 0% 8%",
        cardForeground: "0 0% 92%",
        primary: "0 0% 85%",
        primaryForeground: "0 0% 9%",
        secondary: "0 0% 14%",
        secondaryForeground: "0 0% 92%",
        accent: "0 0% 20%",
        accentForeground: "0 0% 92%",
        destructive: "0 62.8% 30.6%",
        destructiveForeground: "210 40% 98%",
        ring: "0 0% 85%",
      },
    },
    chatBubbles: {
      light: {
        userBubble: "0 0% 15%",
        userBubbleForeground: "0 0% 100%",
        aiBubble: "0 0% 94%",
        aiBubbleForeground: "0 0% 9%",
      },
      dark: {
        userBubble: "0 0% 85%",
        userBubbleForeground: "0 0% 9%",
        aiBubble: "0 0% 14%",
        aiBubbleForeground: "0 0% 92%",
      },
    },
    headingFont: "system",
    bodyFont: "system",
    borderRadius: "small",
    density: "compact",
  },
]

// Get theme by ID
export function getThemeById(id: string): Theme | undefined {
  return presetThemes.find((theme) => theme.id === id)
}

// Get default theme
export function getDefaultTheme(): Theme {
  return presetThemes[0]
}

// Merge custom theme overrides with base theme
export function mergeTheme(baseTheme: Theme, overrides: Partial<Theme>): Theme {
  return {
    ...baseTheme,
    ...overrides,
    colors: {
      light: { ...baseTheme.colors.light, ...overrides.colors?.light },
      dark: { ...baseTheme.colors.dark, ...overrides.colors?.dark },
    },
    chatBubbles: {
      light: { ...baseTheme.chatBubbles.light, ...overrides.chatBubbles?.light },
      dark: { ...baseTheme.chatBubbles.dark, ...overrides.chatBubbles?.dark },
    },
    isCustom: true,
  }
}

// Convert theme to CSS variables object
export function themeToCssVariables(theme: Theme, mode: "light" | "dark"): Record<string, string> {
  const colors = theme.colors[mode]
  const chatBubbles = theme.chatBubbles[mode]

  return {
    "--background": colors.background,
    "--foreground": colors.foreground,
    "--muted": colors.muted,
    "--muted-foreground": colors.mutedForeground,
    "--popover": colors.popover,
    "--popover-foreground": colors.popoverForeground,
    "--border": colors.border,
    "--input": colors.input,
    "--card": colors.card,
    "--card-foreground": colors.cardForeground,
    "--primary": colors.primary,
    "--primary-foreground": colors.primaryForeground,
    "--secondary": colors.secondary,
    "--secondary-foreground": colors.secondaryForeground,
    "--accent": colors.accent,
    "--accent-foreground": colors.accentForeground,
    "--destructive": colors.destructive,
    "--destructive-foreground": colors.destructiveForeground,
    "--ring": colors.ring,
    "--chat-user-bubble": chatBubbles.userBubble,
    "--chat-user-bubble-foreground": chatBubbles.userBubbleForeground,
    "--chat-ai-bubble": chatBubbles.aiBubble,
    "--chat-ai-bubble-foreground": chatBubbles.aiBubbleForeground,
    "--radius": borderRadiusValues[theme.borderRadius],
    "--font-heading": fontFamilyValues[theme.headingFont],
    "--font-body": fontFamilyValues[theme.bodyFont],
    "--density-multiplier": String(densitySpacing[theme.density].base),
  }
}

// Local storage key for theme preference
export const THEME_STORAGE_KEY = "infinistar-theme-preference"

// Save theme preference to localStorage
export function saveThemePreference(preference: UserThemePreference): void {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(preference))
  } catch (error) {
    console.error("Failed to save theme preference:", error)
  }
}

// Load theme preference from localStorage
export function loadThemePreference(): UserThemePreference | null {
  if (typeof window === "undefined") return null
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY)
    if (stored) {
      return JSON.parse(stored) as UserThemePreference
    }
  } catch (error) {
    console.error("Failed to load theme preference:", error)
  }
  return null
}

// Export theme as JSON string
export function exportTheme(theme: Theme): string {
  return JSON.stringify(theme, null, 2)
}

// Import theme from JSON string
export function importTheme(json: string): Theme | null {
  try {
    const parsed = JSON.parse(json) as Theme
    // Validate required fields
    if (!parsed.id || !parsed.name || !parsed.colors || !parsed.chatBubbles) {
      return null
    }
    return {
      ...parsed,
      isCustom: true,
    }
  } catch {
    return null
  }
}

// Check if a color has sufficient contrast (simplified WCAG check)
export function hasMinimumContrast(foreground: string, background: string): boolean {
  // Parse HSL values
  const parseFGHsl = foreground.split(" ").map((v) => parseFloat(v))
  const parseBGHsl = background.split(" ").map((v) => parseFloat(v))

  if (parseFGHsl.length < 3 || parseBGHsl.length < 3) return true

  // Simplified check: ensure lightness difference is at least 40%
  const fgLightness = parseFGHsl[2] || 0
  const bgLightness = parseBGHsl[2] || 0

  return Math.abs(fgLightness - bgLightness) >= 40
}
