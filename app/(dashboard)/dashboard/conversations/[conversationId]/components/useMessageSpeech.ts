"use client"

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react"
import toast from "react-hot-toast"

interface UseMessageSpeechOptions {
  isAI: boolean
  text: string
  isRegenerating: boolean
}

// Speech synthesis support never changes after load; nothing to subscribe to.
const subscribeNoop = () => () => {}
const getSpeechSupport = () =>
  "speechSynthesis" in window && typeof SpeechSynthesisUtterance !== "undefined"
const getServerSpeechSupport = () => false

export function useMessageSpeech({ isAI, text, isRegenerating }: UseMessageSpeechOptions) {
  // Read without an effect + setState, so each mounted message renders once (and
  // the server/hydration render agree on "unsupported").
  const isSpeechSupported = useSyncExternalStore(
    subscribeNoop,
    getSpeechSupport,
    getServerSpeechSupport
  )
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
        toast.error("Couldn't read the message aloud. Try again.")
      }
    }

    speechUtteranceRef.current = utterance
    window.speechSynthesis.cancel()
    window.speechSynthesis.speak(utterance)
    setIsSpeaking(true)
  }, [isSpeechSupported, isAI, text, isSpeaking, isRegenerating, stopSpeech])

  useEffect(() => {
    return () => {
      if (speechUtteranceRef.current && typeof window !== "undefined") {
        window.speechSynthesis.cancel()
        speechUtteranceRef.current = null
      }
    }
  }, [])

  return { isSpeechSupported, isSpeaking, handleToggleSpeech }
}
