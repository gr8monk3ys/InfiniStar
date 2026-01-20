"use client"

import { useCallback, useEffect, useRef } from "react"
import { HiXMark } from "react-icons/hi2"

import { cn } from "@/app/lib/utils"
import {
  isMac,
  useLegacyKeyboardShortcuts,
  type KeyboardShortcut,
} from "@/app/hooks/useKeyboardShortcuts"
import {
  getBrowserSupportInfo,
  isVoiceInputSupported,
  useVoiceInput,
  type UseVoiceInputOptions,
} from "@/app/hooks/useVoiceInput"

import { VoiceInputButton } from "./VoiceInputButton"
import { VoiceLanguageSelectorCompact } from "./VoiceLanguageSelector"
import { VoiceWaveform, VoiceWaveformDots } from "./VoiceWaveform"

/**
 * Mode for handling transcribed text
 */
export type VoiceInputMode = "append" | "replace"

/**
 * Props for the VoiceInput component
 */
export interface VoiceInputProps extends Omit<UseVoiceInputOptions, "onTranscript"> {
  /** Callback when transcript should be applied to input */
  onTranscriptApply: (transcript: string, mode: VoiceInputMode) => void
  /** Current input text (for display in preview) */
  currentText?: string
  /** Whether to show the waveform visualization */
  showWaveform?: boolean
  /** Whether to show the language selector */
  showLanguageSelector?: boolean
  /** Whether to show real-time transcript preview */
  showPreview?: boolean
  /** Default mode for handling transcribed text */
  defaultMode?: VoiceInputMode
  /** Size of the voice button */
  buttonSize?: "sm" | "md" | "lg"
  /** Enable keyboard shortcut (Ctrl/Cmd+Shift+V) */
  enableShortcut?: boolean
  /** Additional CSS classes */
  className?: string
  /** Whether voice input is disabled */
  disabled?: boolean
}

/**
 * VoiceInput Component
 *
 * A complete voice input solution that integrates the microphone button,
 * waveform visualization, language selector, and transcript preview.
 *
 * @example
 * ```tsx
 * <VoiceInput
 *   onTranscriptApply={(text, mode) => {
 *     if (mode === 'append') {
 *       setMessage(prev => prev + ' ' + text);
 *     } else {
 *       setMessage(text);
 *     }
 *   }}
 *   currentText={message}
 *   showWaveform
 *   showPreview
 * />
 * ```
 */
export function VoiceInput({
  onTranscriptApply,
  currentText = "",
  showWaveform = false,
  showLanguageSelector = false,
  showPreview = true,
  defaultMode = "append",
  buttonSize = "md",
  enableShortcut = true,
  className,
  disabled = false,
  language: initialLanguage,
  continuous,
  interimResults,
  silenceTimeout,
  onStateChange,
  onError,
}: VoiceInputProps): JSX.Element | null {
  const isSupported = isVoiceInputSupported()
  const browserInfo = getBrowserSupportInfo()
  const previewRef = useRef<HTMLDivElement>(null)

  // Initialize voice input hook
  const {
    state,
    transcript,
    interimTranscript,
    error: _error,
    errorMessage,
    startListening: _startListening,
    stopListening,
    toggleListening,
    clearTranscript,
    setLanguage,
    language,
  } = useVoiceInput({
    language: initialLanguage,
    continuous,
    interimResults,
    silenceTimeout,
    onStateChange,
    onError,
    onTranscript: (text, isFinal) => {
      if (isFinal) {
        // Apply final transcript to input
        onTranscriptApply(text, defaultMode)
      }
    },
  })

  // Handle keyboard shortcut for voice input
  const shortcuts: KeyboardShortcut[] = enableShortcut
    ? [
        {
          id: "toggle-voice-input",
          name: "Toggle Voice Input",
          description: "Start or stop voice input",
          category: "messages",
          key: "v",
          modifierKey: true,
          shiftKey: true,
          allowInInput: true,
          action: () => {
            if (!disabled && isSupported) {
              toggleListening()
            }
          },
        },
      ]
    : []

  useLegacyKeyboardShortcuts({ shortcuts, enabled: enableShortcut && !disabled })

  // Handle button click
  const handleClick = useCallback(() => {
    toggleListening()
  }, [toggleListening])

  // Handle cancel (stop and clear)
  const handleCancel = useCallback(() => {
    stopListening()
    clearTranscript()
  }, [stopListening, clearTranscript])

  // Scroll preview into view when transcript updates
  useEffect(() => {
    if (previewRef.current && (transcript || interimTranscript)) {
      previewRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" })
    }
  }, [transcript, interimTranscript])

  // If not supported, show a message
  if (!isSupported) {
    return (
      <div className={cn("flex items-center gap-2", className)} role="alert" aria-live="polite">
        <VoiceInputButton
          voiceState="idle"
          isSupported={false}
          onClick={() => {}}
          size={buttonSize}
          errorMessage={browserInfo.message}
        />
        <span className="sr-only">{browserInfo.message}</span>
      </div>
    )
  }

  const _combinedTranscript = transcript + (interimTranscript ? ` ${interimTranscript}` : "")
  const showTranscriptPreview =
    showPreview && state === "listening" && (transcript || interimTranscript)

  return (
    <div className={cn("relative flex items-center gap-2", className)}>
      {/* Language selector (compact) */}
      {showLanguageSelector && (
        <VoiceLanguageSelectorCompact
          selectedLanguage={language}
          onLanguageChange={setLanguage}
          disabled={disabled || state === "listening"}
        />
      )}

      {/* Waveform visualization */}
      {showWaveform && state === "listening" && (
        <VoiceWaveform state={state} barCount={5} height={24} />
      )}

      {/* Dots indicator when listening (alternative to waveform) */}
      {!showWaveform && state === "listening" && <VoiceWaveformDots state={state} />}

      {/* Voice input button */}
      <VoiceInputButton
        voiceState={state}
        isSupported={isSupported}
        onClick={handleClick}
        errorMessage={errorMessage}
        size={buttonSize}
        disabled={disabled}
      />

      {/* Transcript preview overlay */}
      {showTranscriptPreview && (
        <div
          ref={previewRef}
          className="absolute inset-x-0 bottom-full z-10 mb-2 rounded-lg border border-border bg-popover p-3 shadow-lg"
          role="status"
          aria-live="polite"
          aria-label="Voice transcript preview"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1">
              <p className="mb-1 text-xs font-medium text-muted-foreground">Transcribing...</p>
              <p className="text-sm text-foreground">
                {currentText && defaultMode === "append" && (
                  <span className="text-muted-foreground">{currentText} </span>
                )}
                <span>{transcript}</span>
                {interimTranscript && (
                  <span className="italic text-muted-foreground"> {interimTranscript}</span>
                )}
              </p>
            </div>
            <button
              type="button"
              onClick={handleCancel}
              aria-label="Cancel voice input"
              className="rounded-full p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
            >
              <HiXMark className="size-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      )}

      {/* Keyboard shortcut hint */}
      {enableShortcut && state === "idle" && (
        <span className="sr-only">
          Press {isMac() ? "Cmd" : "Ctrl"}+Shift+V to start voice input
        </span>
      )}
    </div>
  )
}

/**
 * Standalone voice input button (minimal version)
 */
export function VoiceInputMinimal({
  onTranscript,
  language = "en-US",
  disabled = false,
  className,
}: {
  onTranscript: (text: string) => void
  language?: string
  disabled?: boolean
  className?: string
}): JSX.Element | null {
  const isSupported = isVoiceInputSupported()

  const { state, errorMessage, toggleListening } = useVoiceInput({
    language,
    onTranscript: (text, isFinal) => {
      if (isFinal) {
        onTranscript(text)
      }
    },
  })

  if (!isSupported) {
    return null
  }

  return (
    <VoiceInputButton
      voiceState={state}
      isSupported={isSupported}
      onClick={toggleListening}
      errorMessage={errorMessage}
      disabled={disabled}
      className={className}
    />
  )
}

export default VoiceInput
