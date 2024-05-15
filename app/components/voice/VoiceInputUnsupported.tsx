"use client"

import { type ReactElement } from "react"
import { HiExclamationTriangle, HiInformationCircle } from "react-icons/hi2"

import { cn } from "@/app/lib/utils"
import { getBrowserSupportInfo } from "@/app/hooks/useVoiceInput"

/**
 * Props for VoiceInputUnsupported component
 */
export interface VoiceInputUnsupportedProps {
  /** Display variant */
  variant?: "inline" | "banner" | "tooltip"
  /** Whether to show additional browser suggestions */
  showSuggestions?: boolean
  /** Additional CSS classes */
  className?: string
}

/**
 * VoiceInputUnsupported Component
 *
 * Displays a message when voice input is not supported in the current browser.
 * Provides helpful information about which browsers support the feature.
 *
 * @example
 * ```tsx
 * <VoiceInputUnsupported
 *   variant="banner"
 *   showSuggestions
 * />
 * ```
 */
export function VoiceInputUnsupported({
  variant = "inline",
  showSuggestions = true,
  className,
}: VoiceInputUnsupportedProps): ReactElement {
  const browserInfo = getBrowserSupportInfo()

  if (variant === "tooltip") {
    return (
      <div
        className={cn("flex max-w-xs items-start gap-2 rounded-md bg-muted p-3 text-sm", className)}
        role="alert"
      >
        <HiInformationCircle
          className="mt-0.5 size-4 shrink-0 text-muted-foreground"
          aria-hidden="true"
        />
        <div>
          <p className="text-foreground">{browserInfo.message}</p>
          {showSuggestions && !browserInfo.supported && (
            <p className="mt-1 text-xs text-muted-foreground">
              Try Chrome, Edge, or Safari for voice input.
            </p>
          )}
        </div>
      </div>
    )
  }

  if (variant === "banner") {
    return (
      <div
        className={cn(
          "flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-900 dark:bg-amber-950",
          className
        )}
        role="alert"
      >
        <HiExclamationTriangle
          className="size-5 shrink-0 text-amber-600 dark:text-amber-500"
          aria-hidden="true"
        />
        <div className="flex-1">
          <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
            Voice Input Not Available
          </p>
          <p className="mt-0.5 text-sm text-amber-700 dark:text-amber-300">{browserInfo.message}</p>
          {showSuggestions && !browserInfo.supported && (
            <div className="mt-2">
              <p className="text-xs text-amber-600 dark:text-amber-400">Supported browsers:</p>
              <ul className="mt-1 flex flex-wrap gap-2 text-xs text-amber-700 dark:text-amber-300">
                <li className="rounded bg-amber-100 px-2 py-0.5 dark:bg-amber-900">
                  Google Chrome
                </li>
                <li className="rounded bg-amber-100 px-2 py-0.5 dark:bg-amber-900">
                  Microsoft Edge
                </li>
                <li className="rounded bg-amber-100 px-2 py-0.5 dark:bg-amber-900">Safari 14.5+</li>
              </ul>
            </div>
          )}
        </div>
      </div>
    )
  }

  // Inline variant (default)
  return (
    <div
      className={cn("flex items-center gap-2 text-sm text-muted-foreground", className)}
      role="alert"
    >
      <HiInformationCircle className="size-4 shrink-0" aria-hidden="true" />
      <span>{browserInfo.message}</span>
    </div>
  )
}

export default VoiceInputUnsupported
