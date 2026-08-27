"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import toast from "react-hot-toast"

interface UseMessageSpeechOptions {
  isAI: boolean
  text: string
  isRegenerating: boolean
}

export function useMessageSpeech({ isAI, text, isRegenerating }: UseMessageSpeechOptions) {
  const [isSpeechSupported, setIsSpeechSupported] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const speechUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null)

  const stopSpeech = useCallback(() => {
    if (!isSpeechSupported || typeof window === "undefined") {
      return
    }

    window.speechSynthesis.cancel()
    speechUtteranceRef.current = null
    setIsSpeaking(false)
  }, [isSpeechSupported])

  const handleToggleSpeech = useCallback(() => {
    if (!isSpeechSupported || !isAI || !text || isRegenerating || typeof window === "undefined") {
      return
    }

    if (isSpeaking) {
      stopSpeech()
      return
    }

    const utterance = new SpeechSynthesisUtterance(text)
    utterance.rate = 1
    utterance.pitch = 1

    utterance.onend = () => {
      if (speechUtteranceRef.current === utterance) {
        speechUtteranceRef.current = null
        setIsSpeaking(false)
      }
    }

    utterance.onerror = () => {
      if (speechUtteranceRef.current === utterance) {
        speechUtteranceRef.current = null
        setIsSpeaking(false)
        toast.error("Text-to-speech failed")
      }
    }

    speechUtteranceRef.current = utterance
    window.speechSynthesis.cancel()
    window.speechSynthesis.speak(utterance)
    setIsSpeaking(true)
  }, [isSpeechSupported, isAI, text, isSpeaking, isRegenerating, stopSpeech])

  useEffect(() => {
    const supported =
      typeof window !== "undefined" &&
      "speechSynthesis" in window &&
      typeof SpeechSynthesisUtterance !== "undefined"
    setIsSpeechSupported(supported)

    return () => {
      if (speechUtteranceRef.current && typeof window !== "undefined") {
        window.speechSynthesis.cancel()
        speechUtteranceRef.current = null
      }
    }
  }, [])

  return { isSpeechSupported, isSpeaking, handleToggleSpeech }
}
