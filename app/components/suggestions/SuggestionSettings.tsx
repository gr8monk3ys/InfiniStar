"use client"

import { useCallback } from "react"
import { HiCog6Tooth } from "react-icons/hi2"

import { cn } from "@/app/lib/utils"
import { useSuggestionPreferences, type SuggestionType } from "@/app/hooks/useSuggestions"

/**
 * Props for SuggestionSettings component
 */
interface SuggestionSettingsProps {
  /** Callback when settings change */
  onSettingsChange?: () => void
  /** Additional CSS classes */
  className?: string
}

/**
 * Available suggestion type options
 */
const SUGGESTION_TYPE_OPTIONS: {
  type: SuggestionType
  label: string
  description: string
}[] = [
  {
    type: "reply",
    label: "Reply Suggestions",
    description: "Suggest responses to AI messages",
  },
  {
    type: "question",
    label: "Follow-up Questions",
    description: "Suggest questions to explore topics deeper",
  },
  {
    type: "continue",
    label: "Continue Typing",
    description: "Complete partial messages as you type",
  },
  {
    type: "rephrase",
    label: "Rephrase Options",
    description: "Offer alternative ways to phrase your message",
  },
]

/**
 * Settings component for configuring suggestion preferences.
 * Manages enable/disable, preferred types, and other preferences.
 */
export function SuggestionSettings({ onSettingsChange, className }: SuggestionSettingsProps) {
  const { preferences, setPreferences } = useSuggestionPreferences()

  const handleToggleEnabled = useCallback(() => {
    setPreferences({ enabled: !preferences.enabled })
    onSettingsChange?.()
  }, [preferences.enabled, setPreferences, onSettingsChange])

  const handleToggleType = useCallback(
    (type: SuggestionType) => {
      const isCurrentlyEnabled = preferences.preferredTypes.includes(type)
      const newTypes = isCurrentlyEnabled
        ? preferences.preferredTypes.filter((t) => t !== type)
        : [...preferences.preferredTypes, type]

      // Ensure at least one type is selected
      if (newTypes.length === 0) {
        return
      }

      setPreferences({ preferredTypes: newTypes })
      onSettingsChange?.()
    },
    [preferences.preferredTypes, setPreferences, onSettingsChange]
  )

  const handleToggleAutoShow = useCallback(() => {
    setPreferences({ autoShow: !preferences.autoShow })
    onSettingsChange?.()
  }, [preferences.autoShow, setPreferences, onSettingsChange])

  const handleMaxSuggestionsChange = useCallback(
    (value: number) => {
      if (value >= 2 && value <= 5) {
        setPreferences({ maxSuggestions: value })
        onSettingsChange?.()
      }
    },
    [setPreferences, onSettingsChange]
  )

  return (
    <div className={cn("rounded-lg border border-border bg-background p-4", className)}>
      <div className="mb-4 flex items-center gap-2">
        <HiCog6Tooth className="size-5 text-muted-foreground" aria-hidden="true" />
        <h3 className="text-sm font-medium text-foreground">Suggestion Settings</h3>
      </div>

      {/* Enable/Disable Toggle */}
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-foreground">Enable Suggestions</p>
          <p className="text-xs text-muted-foreground">Show AI-powered message suggestions</p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={preferences.enabled}
          onClick={handleToggleEnabled}
          className={cn(
            "relative h-6 w-11 rounded-full transition-colors",
            "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
            preferences.enabled ? "bg-primary" : "bg-muted"
          )}
        >
          <span
            className={cn(
              "absolute left-0.5 top-0.5 size-5 rounded-full bg-white shadow transition-transform",
              preferences.enabled ? "translate-x-5" : "translate-x-0"
            )}
          />
        </button>
      </div>

      {/* Settings only shown when enabled */}
      {preferences.enabled && (
        <>
          {/* Auto-show Toggle */}
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">Auto-show Suggestions</p>
              <p className="text-xs text-muted-foreground">
                Automatically show suggestions after AI responds
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={preferences.autoShow}
              onClick={handleToggleAutoShow}
              className={cn(
                "relative h-6 w-11 rounded-full transition-colors",
                "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
                preferences.autoShow ? "bg-primary" : "bg-muted"
              )}
            >
              <span
                className={cn(
                  "absolute left-0.5 top-0.5 size-5 rounded-full bg-white shadow transition-transform",
                  preferences.autoShow ? "translate-x-5" : "translate-x-0"
                )}
              />
            </button>
          </div>

          {/* Number of Suggestions */}
          <div className="mb-4">
            <p className="mb-2 text-sm font-medium text-foreground">Number of Suggestions</p>
            <div className="flex gap-2">
              {[2, 3, 4, 5].map((num) => (
                <button
                  key={num}
                  type="button"
                  onClick={() => handleMaxSuggestionsChange(num)}
                  className={cn(
                    "size-8 rounded-md text-sm font-medium transition-colors",
                    "focus:outline-none focus:ring-2 focus:ring-ring",
                    preferences.maxSuggestions === num
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:bg-accent hover:text-foreground"
                  )}
                  aria-label={`Show ${num} suggestions`}
                  aria-pressed={preferences.maxSuggestions === num}
                >
                  {num}
                </button>
              ))}
            </div>
          </div>

          {/* Suggestion Types */}
          <div>
            <p className="mb-2 text-sm font-medium text-foreground">Suggestion Types</p>
            <div className="space-y-2">
              {SUGGESTION_TYPE_OPTIONS.map((option) => {
                const isEnabled = preferences.preferredTypes.includes(option.type)
                const isOnlyEnabled = isEnabled && preferences.preferredTypes.length === 1

                return (
                  <button
                    key={option.type}
                    type="button"
                    onClick={() => handleToggleType(option.type)}
                    disabled={isOnlyEnabled}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-md border p-2 text-left transition-colors",
                      "focus:outline-none focus:ring-2 focus:ring-ring",
                      isEnabled
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-muted-foreground/50",
                      isOnlyEnabled && "cursor-not-allowed opacity-50"
                    )}
                    aria-pressed={isEnabled}
                    aria-label={`${option.label}: ${option.description}`}
                  >
                    <div
                      className={cn(
                        "flex size-5 items-center justify-center rounded border",
                        isEnabled
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border"
                      )}
                    >
                      {isEnabled && (
                        <svg
                          className="size-3"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={3}
                          aria-hidden="true"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-foreground">{option.label}</p>
                      <p className="text-xs text-muted-foreground">{option.description}</p>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

export default SuggestionSettings
