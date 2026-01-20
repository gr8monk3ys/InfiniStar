"use client"

import { forwardRef, useCallback, useEffect, useState } from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { HiExclamationCircle, HiMicrophone, HiStop } from "react-icons/hi2"

import { cn } from "@/app/lib/utils"
import type { VoiceInputState } from "@/app/hooks/useVoiceInput"

/**
 * Voice input button variants using class-variance-authority
 */
const voiceButtonVariants = cva(
  "relative inline-flex items-center justify-center rounded-full transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
  {
    variants: {
      size: {
        sm: "h-8 w-8",
        md: "h-10 w-10",
        lg: "h-12 w-12",
      },
      state: {
        idle: "bg-secondary text-muted-foreground hover:bg-secondary/80 hover:text-foreground",
        listening: "bg-red-500 text-white hover:bg-red-600",
        processing: "bg-amber-500 text-white cursor-wait",
        error: "bg-destructive text-destructive-foreground",
        disabled: "bg-muted text-muted-foreground cursor-not-allowed opacity-50",
      },
    },
    defaultVariants: {
      size: "md",
      state: "idle",
    },
  }
)

/**
 * Pulse animation for listening state
 */
const PulseRing = () => (
  <span
    className="absolute inset-0 animate-ping rounded-full bg-red-400 opacity-75"
    aria-hidden="true"
  />
)

/**
 * Loading spinner for processing state
 */
const LoadingSpinner = () => (
  <svg
    className="size-5 animate-spin"
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    aria-hidden="true"
  >
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path
      className="opacity-75"
      fill="currentColor"
      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
    />
  </svg>
)

/**
 * Props for the VoiceInputButton component
 */
export interface VoiceInputButtonProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "onClick">,
    VariantProps<typeof voiceButtonVariants> {
  /** Current voice input state */
  voiceState: VoiceInputState
  /** Whether voice input is supported */
  isSupported: boolean
  /** Callback when button is clicked */
  onClick: () => void
  /** Error message to show in tooltip */
  errorMessage?: string | null
  /** Show pulse animation when listening */
  showPulse?: boolean
  /** Additional CSS classes */
  className?: string
}

/**
 * VoiceInputButton Component
 *
 * A microphone button with visual feedback for different voice input states.
 * Shows appropriate icons and animations based on the current state.
 *
 * @example
 * ```tsx
 * <VoiceInputButton
 *   voiceState={state}
 *   isSupported={isSupported}
 *   onClick={toggleListening}
 *   errorMessage={errorMessage}
 * />
 * ```
 */
export const VoiceInputButton = forwardRef<HTMLButtonElement, VoiceInputButtonProps>(
  (
    {
      voiceState,
      isSupported,
      onClick,
      errorMessage,
      showPulse = true,
      size,
      className,
      disabled,
      ...props
    },
    ref
  ) => {
    const [showTooltip, setShowTooltip] = useState(false)
    const [announcedState, setAnnouncedState] = useState<VoiceInputState>(voiceState)

    // Determine the effective state for styling
    const effectiveState = disabled || !isSupported ? "disabled" : voiceState

    // Get the appropriate icon based on state
    const renderIcon = () => {
      switch (voiceState) {
        case "listening":
          return <HiStop className="size-5" aria-hidden="true" />
        case "processing":
          return <LoadingSpinner />
        case "error":
          return <HiExclamationCircle className="size-5" aria-hidden="true" />
        default:
          return <HiMicrophone className="size-5" aria-hidden="true" />
      }
    }

    // Get the appropriate aria-label
    const getAriaLabel = () => {
      if (!isSupported) {
        return "Voice input not supported in this browser"
      }
      switch (voiceState) {
        case "listening":
          return "Stop listening for voice input"
        case "processing":
          return "Processing voice input"
        case "error":
          return `Voice input error: ${errorMessage || "Unknown error"}`
        default:
          return "Start voice input"
      }
    }

    // Handle click with keyboard support
    const handleClick = useCallback(() => {
      if (disabled || !isSupported || voiceState === "processing") {
        return
      }
      onClick()
    }, [disabled, isSupported, voiceState, onClick])

    // Handle keyboard interaction
    const handleKeyDown = useCallback(
      (e: React.KeyboardEvent) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          handleClick()
        }
      },
      [handleClick]
    )

    // Announce state changes to screen readers
    useEffect(() => {
      if (voiceState !== announcedState) {
        setAnnouncedState(voiceState)
      }
    }, [voiceState, announcedState])

    // Show tooltip on error
    useEffect(() => {
      if (voiceState === "error" && errorMessage) {
        setShowTooltip(true)
        const timer = setTimeout(() => setShowTooltip(false), 5000)
        return () => clearTimeout(timer)
      }
      return undefined
    }, [voiceState, errorMessage])

    return (
      <div className="relative inline-flex">
        {/* Pulse animation for listening state */}
        {voiceState === "listening" && showPulse && (
          <span className="absolute inset-0">
            <PulseRing />
          </span>
        )}

        <button
          ref={ref}
          type="button"
          onClick={handleClick}
          onKeyDown={handleKeyDown}
          disabled={disabled || !isSupported || voiceState === "processing"}
          aria-label={getAriaLabel()}
          aria-pressed={voiceState === "listening"}
          aria-busy={voiceState === "processing"}
          aria-describedby={errorMessage ? "voice-error-tooltip" : undefined}
          className={cn(voiceButtonVariants({ size, state: effectiveState }), className)}
          {...props}
        >
          {renderIcon()}
        </button>

        {/* Error tooltip */}
        {showTooltip && errorMessage && (
          <div
            id="voice-error-tooltip"
            role="alert"
            className="absolute bottom-full left-1/2 z-50 mb-2 w-max max-w-xs -translate-x-1/2 rounded-md bg-destructive px-3 py-2 text-sm text-destructive-foreground shadow-lg"
          >
            <div className="relative">
              {errorMessage}
              {/* Tooltip arrow */}
              <div className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-destructive" />
            </div>
          </div>
        )}

        {/* Screen reader announcements */}
        <span className="sr-only" role="status" aria-live="polite">
          {voiceState === "listening" && "Listening for voice input"}
          {voiceState === "processing" && "Processing your speech"}
          {voiceState === "error" && `Error: ${errorMessage}`}
          {voiceState === "idle" && announcedState === "listening" && "Voice input stopped"}
        </span>
      </div>
    )
  }
)

VoiceInputButton.displayName = "VoiceInputButton"

export default VoiceInputButton
