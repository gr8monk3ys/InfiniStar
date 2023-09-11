"use client"

import { useCallback, useEffect, useRef, useState } from "react"

/**
 * Voice input states
 */
export type VoiceInputState = "idle" | "listening" | "processing" | "error"

/**
 * Voice input error types
 */
export type VoiceInputError =
  | "not-supported"
  | "permission-denied"
  | "no-speech"
  | "audio-capture"
  | "network"
  | "aborted"
  | "unknown"

/**
 * Supported languages for voice recognition
 */
export interface VoiceLanguage {
  code: string
  name: string
  nativeName: string
}

/**
 * Common languages supported by Web Speech API
 */
export const VOICE_LANGUAGES: VoiceLanguage[] = [
  { code: "en-US", name: "English (US)", nativeName: "English" },
  { code: "en-GB", name: "English (UK)", nativeName: "English" },
  { code: "es-ES", name: "Spanish", nativeName: "Espanol" },
  { code: "es-MX", name: "Spanish (Mexico)", nativeName: "Espanol (Mexico)" },
  { code: "fr-FR", name: "French", nativeName: "Francais" },
  { code: "de-DE", name: "German", nativeName: "Deutsch" },
  { code: "it-IT", name: "Italian", nativeName: "Italiano" },
  { code: "pt-BR", name: "Portuguese (Brazil)", nativeName: "Portugues" },
  { code: "pt-PT", name: "Portuguese (Portugal)", nativeName: "Portugues" },
  { code: "zh-CN", name: "Chinese (Simplified)", nativeName: "Zhongwen" },
  { code: "zh-TW", name: "Chinese (Traditional)", nativeName: "Zhongwen" },
  { code: "ja-JP", name: "Japanese", nativeName: "Nihongo" },
  { code: "ko-KR", name: "Korean", nativeName: "Hangugeo" },
  { code: "ru-RU", name: "Russian", nativeName: "Russkiy" },
  { code: "ar-SA", name: "Arabic", nativeName: "Alarabiya" },
  { code: "hi-IN", name: "Hindi", nativeName: "Hindi" },
  { code: "nl-NL", name: "Dutch", nativeName: "Nederlands" },
  { code: "pl-PL", name: "Polish", nativeName: "Polski" },
  { code: "tr-TR", name: "Turkish", nativeName: "Turkce" },
  { code: "vi-VN", name: "Vietnamese", nativeName: "Tieng Viet" },
]

/**
 * Options for the useVoiceInput hook
 */
export interface UseVoiceInputOptions {
  /** Language for speech recognition (default: "en-US") */
  language?: string
  /** Enable continuous listening mode (default: false) */
  continuous?: boolean
  /** Show interim (partial) results while speaking (default: true) */
  interimResults?: boolean
  /** Auto-stop after silence in milliseconds (default: 3000ms) */
  silenceTimeout?: number
  /** Callback when transcription is updated */
  onTranscript?: (transcript: string, isFinal: boolean) => void
  /** Callback when voice input state changes */
  onStateChange?: (state: VoiceInputState) => void
  /** Callback when an error occurs */
  onError?: (error: VoiceInputError, message: string) => void
}

/**
 * Return type for the useVoiceInput hook
 */
export interface UseVoiceInputReturn {
  /** Current voice input state */
  state: VoiceInputState
  /** Whether voice input is supported in the current browser */
  isSupported: boolean
  /** Current transcription text */
  transcript: string
  /** Interim (partial) transcription while speaking */
  interimTranscript: string
  /** Error type if an error occurred */
  error: VoiceInputError | null
  /** Human-readable error message */
  errorMessage: string | null
  /** Start listening for voice input */
  startListening: () => void
  /** Stop listening */
  stopListening: () => void
  /** Toggle listening state */
  toggleListening: () => void
  /** Clear the current transcript */
  clearTranscript: () => void
  /** Set the recognition language */
  setLanguage: (language: string) => void
  /** Current language code */
  language: string
  /** Check if microphone permission is granted */
  checkPermission: () => Promise<boolean>
}

/**
 * Browser-specific SpeechRecognition interface
 */
interface SpeechRecognitionEvent extends Event {
  resultIndex: number
  results: SpeechRecognitionResultList
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string
  message: string
}

interface SpeechRecognitionResult {
  isFinal: boolean
  [index: number]: SpeechRecognitionAlternative
  length: number
}

interface SpeechRecognitionAlternative {
  transcript: string
  confidence: number
}

interface SpeechRecognitionResultList {
  [index: number]: SpeechRecognitionResult
  length: number
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean
  interimResults: boolean
  lang: string
  maxAlternatives: number
  start: () => void
  stop: () => void
  abort: () => void
  onstart: ((this: SpeechRecognition, ev: Event) => void) | null
  onend: ((this: SpeechRecognition, ev: Event) => void) | null
  onresult: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => void) | null
  onerror: ((this: SpeechRecognition, ev: SpeechRecognitionErrorEvent) => void) | null
  onspeechend: ((this: SpeechRecognition, ev: Event) => void) | null
  onnomatch: ((this: SpeechRecognition, ev: Event) => void) | null
  onaudiostart: ((this: SpeechRecognition, ev: Event) => void) | null
  onaudioend: ((this: SpeechRecognition, ev: Event) => void) | null
  onsoundstart: ((this: SpeechRecognition, ev: Event) => void) | null
  onsoundend: ((this: SpeechRecognition, ev: Event) => void) | null
}

declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognition
    webkitSpeechRecognition: new () => SpeechRecognition
  }
}

/**
 * Get the SpeechRecognition constructor for the current browser
 */
function getSpeechRecognition(): (new () => SpeechRecognition) | null {
  if (typeof window === "undefined") return null
  return window.SpeechRecognition || window.webkitSpeechRecognition || null
}

/**
 * Check if voice input is supported in the current browser
 */
export function isVoiceInputSupported(): boolean {
  return getSpeechRecognition() !== null
}

/**
 * Get browser support info for display
 */
export function getBrowserSupportInfo(): {
  supported: boolean
  browser: string
  message: string
} {
  if (typeof window === "undefined") {
    return {
      supported: false,
      browser: "unknown",
      message: "Voice input requires a browser environment.",
    }
  }

  const userAgent = navigator.userAgent.toLowerCase()
  const isChrome = userAgent.includes("chrome") && !userAgent.includes("edg")
  const isEdge = userAgent.includes("edg")
  const isSafari = userAgent.includes("safari") && !userAgent.includes("chrome")
  const isFirefox = userAgent.includes("firefox")

  if (isFirefox) {
    return {
      supported: false,
      browser: "Firefox",
      message: "Voice input is not supported in Firefox. Please use Chrome, Edge, or Safari.",
    }
  }

  if (isSafari) {
    return {
      supported: getSpeechRecognition() !== null,
      browser: "Safari",
      message: getSpeechRecognition()
        ? "Voice input is supported with limited features in Safari."
        : "Voice input requires Safari 14.5 or later on iOS, or macOS Big Sur or later.",
    }
  }

  if (isChrome) {
    return {
      supported: true,
      browser: "Chrome",
      message: "Full voice input support available.",
    }
  }

  if (isEdge) {
    return {
      supported: true,
      browser: "Edge",
      message: "Full voice input support available.",
    }
  }

  return {
    supported: getSpeechRecognition() !== null,
    browser: "unknown",
    message: getSpeechRecognition()
      ? "Voice input may be available with limited features."
      : "Voice input is not supported in your browser. Please use Chrome or Edge.",
  }
}

/**
 * Map speech recognition error codes to our error types
 */
function mapErrorCode(errorCode: string): VoiceInputError {
  switch (errorCode) {
    case "not-allowed":
      return "permission-denied"
    case "no-speech":
      return "no-speech"
    case "audio-capture":
      return "audio-capture"
    case "network":
      return "network"
    case "aborted":
      return "aborted"
    default:
      return "unknown"
  }
}

/**
 * Get a human-readable error message
 */
function getErrorMessage(error: VoiceInputError): string {
  switch (error) {
    case "not-supported":
      return "Voice input is not supported in your browser. Please use Chrome, Edge, or Safari."
    case "permission-denied":
      return "Microphone access was denied. Please allow microphone access in your browser settings."
    case "no-speech":
      return "No speech was detected. Please try speaking again."
    case "audio-capture":
      return "Could not capture audio. Please check your microphone."
    case "network":
      return "Network error occurred. Please check your internet connection."
    case "aborted":
      return "Voice input was cancelled."
    default:
      return "An unknown error occurred. Please try again."
  }
}

/**
 * Hook for voice input using the Web Speech API
 *
 * @param options - Configuration options
 * @returns Voice input state and control functions
 *
 * @example
 * ```tsx
 * const {
 *   state,
 *   isSupported,
 *   transcript,
 *   startListening,
 *   stopListening,
 * } = useVoiceInput({
 *   language: 'en-US',
 *   onTranscript: (text, isFinal) => {
 *     if (isFinal) setMessage(prev => prev + text);
 *   }
 * });
 * ```
 */
export function useVoiceInput(options: UseVoiceInputOptions = {}): UseVoiceInputReturn {
  const {
    language: initialLanguage = "en-US",
    continuous = false,
    interimResults = true,
    silenceTimeout = 3000,
    onTranscript,
    onStateChange,
    onError,
  } = options

  const [state, setState] = useState<VoiceInputState>("idle")
  const [transcript, setTranscript] = useState("")
  const [interimTranscript, setInterimTranscript] = useState("")
  const [error, setError] = useState<VoiceInputError | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [language, setLanguageState] = useState(initialLanguage)

  const recognitionRef = useRef<SpeechRecognition | null>(null)
  const silenceTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const isListeningRef = useRef(false)

  const isSupported = typeof window !== "undefined" && getSpeechRecognition() !== null

  // Update state and notify callback
  const updateState = useCallback(
    (newState: VoiceInputState) => {
      setState(newState)
      onStateChange?.(newState)
    },
    [onStateChange]
  )

  // Clear silence timeout
  const clearSilenceTimeout = useCallback(() => {
    if (silenceTimeoutRef.current) {
      clearTimeout(silenceTimeoutRef.current)
      silenceTimeoutRef.current = null
    }
  }, [])

  // Reset silence timeout
  const resetSilenceTimeout = useCallback(() => {
    clearSilenceTimeout()
    if (silenceTimeout > 0 && !continuous) {
      silenceTimeoutRef.current = setTimeout(() => {
        if (isListeningRef.current && recognitionRef.current) {
          recognitionRef.current.stop()
        }
      }, silenceTimeout)
    }
  }, [clearSilenceTimeout, silenceTimeout, continuous])

  // Handle recognition error
  const handleError = useCallback(
    (errorType: VoiceInputError, customMessage?: string) => {
      const message = customMessage || getErrorMessage(errorType)
      setError(errorType)
      setErrorMessage(message)
      updateState("error")
      onError?.(errorType, message)
    },
    [onError, updateState]
  )

  // Initialize recognition instance
  const initRecognition = useCallback(() => {
    const SpeechRecognitionConstructor = getSpeechRecognition()
    if (!SpeechRecognitionConstructor) {
      handleError("not-supported")
      return null
    }

    const recognition = new SpeechRecognitionConstructor()
    recognition.continuous = continuous
    recognition.interimResults = interimResults
    recognition.lang = language
    recognition.maxAlternatives = 1

    recognition.onstart = () => {
      isListeningRef.current = true
      updateState("listening")
      setError(null)
      setErrorMessage(null)
      resetSilenceTimeout()
    }

    recognition.onend = () => {
      isListeningRef.current = false
      clearSilenceTimeout()
      if (state !== "error") {
        updateState("idle")
      }
    }

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      resetSilenceTimeout()

      let finalTranscript = ""
      let interimText = ""

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i]
        const transcriptText = result[0].transcript

        if (result.isFinal) {
          finalTranscript += transcriptText
        } else {
          interimText += transcriptText
        }
      }

      if (finalTranscript) {
        setTranscript((prev) => prev + finalTranscript)
        onTranscript?.(finalTranscript, true)
      }

      setInterimTranscript(interimText)
      if (interimText) {
        onTranscript?.(interimText, false)
      }
    }

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      clearSilenceTimeout()
      isListeningRef.current = false
      const errorType = mapErrorCode(event.error)

      // Don't report aborted as an error if we intentionally stopped
      if (errorType === "aborted") {
        updateState("idle")
        return
      }

      handleError(errorType)
    }

    recognition.onspeechend = () => {
      updateState("processing")
    }

    return recognition
  }, [
    continuous,
    interimResults,
    language,
    resetSilenceTimeout,
    clearSilenceTimeout,
    handleError,
    onTranscript,
    state,
    updateState,
  ])

  // Start listening
  const startListening = useCallback(() => {
    if (!isSupported) {
      handleError("not-supported")
      return
    }

    // Stop any existing recognition
    if (recognitionRef.current) {
      recognitionRef.current.abort()
    }

    // Clear previous transcript
    setInterimTranscript("")

    // Initialize new recognition instance
    const recognition = initRecognition()
    if (!recognition) return

    recognitionRef.current = recognition

    try {
      recognition.start()
    } catch (err) {
      // Handle the case where recognition is already started
      console.error("Speech recognition start error:", err)
      handleError("unknown")
    }
  }, [isSupported, handleError, initRecognition])

  // Stop listening
  const stopListening = useCallback(() => {
    clearSilenceTimeout()
    if (recognitionRef.current && isListeningRef.current) {
      recognitionRef.current.stop()
    }
  }, [clearSilenceTimeout])

  // Toggle listening
  const toggleListening = useCallback(() => {
    if (isListeningRef.current) {
      stopListening()
    } else {
      startListening()
    }
  }, [startListening, stopListening])

  // Clear transcript
  const clearTranscript = useCallback(() => {
    setTranscript("")
    setInterimTranscript("")
  }, [])

  // Set language
  const setLanguage = useCallback((newLanguage: string) => {
    setLanguageState(newLanguage)
  }, [])

  // Check microphone permission
  const checkPermission = useCallback(async (): Promise<boolean> => {
    if (typeof navigator === "undefined" || !navigator.permissions) {
      // Fallback: try to access microphone directly
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        stream.getTracks().forEach((track) => track.stop())
        return true
      } catch {
        return false
      }
    }

    try {
      const result = await navigator.permissions.query({ name: "microphone" as PermissionName })
      return result.state === "granted"
    } catch {
      // Permission API not supported for microphone, try direct access
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        stream.getTracks().forEach((track) => track.stop())
        return true
      } catch {
        return false
      }
    }
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearSilenceTimeout()
      if (recognitionRef.current) {
        recognitionRef.current.abort()
      }
    }
  }, [clearSilenceTimeout])

  // Update recognition language when it changes
  useEffect(() => {
    if (recognitionRef.current && !isListeningRef.current) {
      recognitionRef.current.lang = language
    }
  }, [language])

  return {
    state,
    isSupported,
    transcript,
    interimTranscript,
    error,
    errorMessage,
    startListening,
    stopListening,
    toggleListening,
    clearTranscript,
    setLanguage,
    language,
    checkPermission,
  }
}

export default useVoiceInput
