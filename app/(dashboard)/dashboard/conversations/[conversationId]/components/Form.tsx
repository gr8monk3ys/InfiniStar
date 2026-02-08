"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import dynamic from "next/dynamic"
import { useAuth } from "@clerk/nextjs"
import axios from "axios"
import type { CloudinaryUploadWidgetResults } from "next-cloudinary"
import { useForm, type FieldValues, type SubmitHandler } from "react-hook-form"
import toast from "react-hot-toast"
import { HiPaperAirplane, HiPhoto } from "react-icons/hi2"

import useConversation from "@/app/(dashboard)/dashboard/hooks/useConversation"
import { SuggestionChips } from "@/app/components/suggestions"
import { isVoiceInputSupported, VoiceInput, type VoiceInputMode } from "@/app/components/voice"
import { useAiChatStream, type TokenUsage } from "@/app/hooks/useAiChatStream"
import { useCsrfToken } from "@/app/hooks/useCsrfToken"
import { useSuggestionPreferences, useSuggestions } from "@/app/hooks/useSuggestions"
import { useTokenUsageStore } from "@/app/hooks/useTokenUsage"
import { useTypingIndicator } from "@/app/hooks/useTypingIndicator"
import { type FullMessageType } from "@/app/types"

import MessageInput from "./MessageInput"

// Dynamic import to avoid build-time Cloudinary validation
const CldUploadButton = dynamic(
  () => import("next-cloudinary").then((mod) => mod.CldUploadButton),
  { ssr: false }
)

interface FormProps {
  isAI?: boolean
  enableStreaming?: boolean
  /** Callback when typing users change (for parent component to display indicator) */
  _onTypingChange?: (typingUsers: string[]) => void
  /** Callback when AI streaming state changes */
  onAIStreamingChange?: (isStreaming: boolean) => void
  /** Enable voice input feature */
  enableVoiceInput?: boolean
  /** Messages for AI suggestions context */
  messages?: FullMessageType[]
}

const Form: React.FC<FormProps> = ({
  isAI = false,
  enableStreaming = true,
  _onTypingChange,
  onAIStreamingChange,
  enableVoiceInput = true,
  messages = [],
}) => {
  const { conversationId } = useConversation()
  const [isLoading, setIsLoading] = useState(false)
  const { token: csrfToken } = useCsrfToken()
  const { userId } = useAuth()
  const currentUserId = userId ?? undefined

  // Check if voice input is supported
  const voiceSupported = isVoiceInputSupported()

  // Suggestions state and hook (only for AI conversations)
  const { preferences: suggestionPrefs } = useSuggestionPreferences()
  const [showSuggestions, setShowSuggestions] = useState(true)

  const {
    suggestions,
    isLoading: suggestionsLoading,
    clearSuggestions,
    refreshSuggestions,
    isEnabled: suggestionsEnabled,
  } = useSuggestions({
    conversationId,
    messages,
    enabled: isAI && suggestionPrefs.enabled && showSuggestions,
    autoFetchOnAiResponse: suggestionPrefs.autoShow,
  })

  // Set up typing indicator hook for human-to-human conversations
  const { emitTyping } = useTypingIndicator({
    conversationId,
    currentUserId,
  })

  // Debounce ref for typing indicator
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Token usage store for sharing with TokenUsageDisplay
  const setLatestUsage = useTokenUsageStore((state) => state.setLatestUsage)

  // Set up streaming hook for AI conversations
  const { sendMessage: sendStreamingMessage, isStreaming } = useAiChatStream({
    conversationId,
    csrfToken,
    onComplete: (_messageId: string, usage?: TokenUsage) => {
      toast.success("AI response complete")
      // Update token usage store when we receive usage data
      if (usage) {
        setLatestUsage(usage, conversationId)
      }
    },
    onError: (error) => {
      toast.error(`AI error: ${error}`)
    },
  })

  // Notify parent of AI streaming state changes
  useEffect(() => {
    onAIStreamingChange?.(isStreaming)
  }, [isStreaming, onAIStreamingChange])

  const {
    register,
    handleSubmit,
    setValue,
    getValues,
    watch,
    formState: { errors },
  } = useForm<FieldValues>({
    defaultValues: {
      message: "",
    },
  })

  // Watch the current message value for voice input preview
  const currentMessage = watch("message")

  // Ref to store onSubmit function for use in keyboard shortcut callback
  const formRef = useRef<HTMLFormElement>(null)

  // Handle suggestion selection - insert into message input
  const handleSuggestionSelect = useCallback(
    (text: string) => {
      const currentValue = getValues("message") || ""
      // If there's existing text, append with a space; otherwise replace
      const newValue = currentValue.trim() ? `${currentValue.trim()} ${text}` : text
      setValue("message", newValue, { shouldValidate: true })
      clearSuggestions()
      // Hide suggestions after selection
      setShowSuggestions(false)
      // Re-show after a delay
      setTimeout(() => setShowSuggestions(true), 1000)
    },
    [getValues, setValue, clearSuggestions]
  )

  // Handle suggestions dismiss
  const handleSuggestionsDismiss = useCallback(() => {
    clearSuggestions()
    setShowSuggestions(false)
    // Re-enable after some time
    setTimeout(() => setShowSuggestions(true), 30000)
  }, [clearSuggestions])

  // Handle Cmd/Ctrl+Enter shortcut to submit by programmatically requesting form submit
  const handleModifierEnterSubmit = useCallback(() => {
    const values = getValues()
    if (values.message && values.message.trim() && formRef.current) {
      formRef.current.requestSubmit()
    }
  }, [getValues])

  // Handle input change for typing indicator (debounced)
  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      // Only emit typing for non-AI conversations
      if (isAI) return

      const hasContent = e.target.value.length > 0

      // Clear existing timeout
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current)
      }

      if (hasContent) {
        // Emit typing = true
        emitTyping(true)

        // Set timeout to clear typing after 3 seconds of no input
        typingTimeoutRef.current = setTimeout(() => {
          emitTyping(false)
        }, 3000)
      } else {
        // Input is empty, stop typing
        emitTyping(false)
      }
    },
    [isAI, emitTyping]
  )

  // Handle voice input transcript
  const handleVoiceTranscript = useCallback(
    (transcript: string, mode: VoiceInputMode) => {
      const currentValue = getValues("message") || ""

      if (mode === "append") {
        // Append transcript to existing text with a space
        const newValue = currentValue ? `${currentValue} ${transcript}` : transcript
        setValue("message", newValue, { shouldValidate: true })
      } else {
        // Replace existing text
        setValue("message", transcript, { shouldValidate: true })
      }

      // Emit typing indicator for non-AI conversations
      if (!isAI) {
        emitTyping(true)
        if (typingTimeoutRef.current) {
          clearTimeout(typingTimeoutRef.current)
        }
        typingTimeoutRef.current = setTimeout(() => {
          emitTyping(false)
        }, 3000)
      }
    },
    [getValues, setValue, isAI, emitTyping]
  )

  // Handle voice input state changes
  const handleVoiceStateChange = useCallback(
    (state: "idle" | "listening" | "processing" | "error") => {
      // Show typing indicator when listening
      if (!isAI && state === "listening") {
        emitTyping(true)
      }
    },
    [isAI, emitTyping]
  )

  // Handle voice input errors
  const handleVoiceError = useCallback((error: string, message: string) => {
    if (error !== "aborted") {
      toast.error(message)
    }
  }, [])

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current)
      }
    }
  }, [])

  const onSubmit: SubmitHandler<FieldValues> = async (data) => {
    if (!csrfToken) {
      toast.error("Security token not available. Please refresh the page.")
      return
    }

    // Clear typing indicator when message is sent
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current)
    }
    emitTyping(false)

    setValue("message", "", { shouldValidate: true })

    const headers = {
      "X-CSRF-Token": csrfToken,
      "Content-Type": "application/json",
    }

    if (isAI) {
      // Use streaming for AI if enabled
      if (enableStreaming) {
        await sendStreamingMessage(data.message)
      } else {
        // Fallback to non-streaming endpoint
        setIsLoading(true)
        try {
          await axios.post(
            "/api/ai/chat",
            {
              message: data.message,
              conversationId: conversationId,
            },
            { headers }
          )
        } catch (error) {
          console.error("AI chat error:", error)
          toast.error("Failed to send message to AI")
        } finally {
          setIsLoading(false)
        }
      }
    } else {
      // Send to regular messages endpoint
      axios
        .post(
          "/api/messages",
          {
            ...data,
            conversationId: conversationId,
          },
          { headers }
        )
        .catch((error) => {
          console.error("Message send error:", error)
          toast.error("Failed to send message")
        })
    }
  }

  const handleUpload = (result: CloudinaryUploadWidgetResults) => {
    if (!csrfToken) {
      toast.error("Security token not available. Please refresh the page.")
      return
    }

    if (result.info && typeof result.info !== "string" && result.info.secure_url) {
      axios
        .post(
          "/api/messages",
          {
            image: result.info.secure_url,
            conversationId: conversationId,
          },
          {
            headers: { "X-CSRF-Token": csrfToken },
          }
        )
        .catch((error) => {
          console.error("Image upload error:", error)
          toast.error("Failed to upload image")
        })
    }
  }

  // Hide suggestions when user is actively typing
  const shouldShowSuggestions =
    isAI &&
    suggestionsEnabled &&
    showSuggestions &&
    (suggestions.length > 0 || suggestionsLoading) &&
    currentMessage.length === 0

  return (
    <div
      className="w-full border-t border-border bg-background"
      role="region"
      aria-label="Message input area"
    >
      {/* AI Suggestions - shown above the input when available */}
      {shouldShowSuggestions && (
        <div className="px-4 pt-2">
          <SuggestionChips
            suggestions={suggestions}
            onSelect={handleSuggestionSelect}
            isLoading={suggestionsLoading}
            onRefresh={refreshSuggestions}
            onDismiss={handleSuggestionsDismiss}
            disabled={isLoading || isStreaming}
          />
        </div>
      )}

      <div className="flex w-full items-center gap-2 p-4">
        {!isAI && (
          <CldUploadButton
            options={{ maxFiles: 1 }}
            onUpload={handleUpload}
            uploadPreset="pgc9ehd5"
          >
            <HiPhoto
              size={30}
              className="text-sky-500"
              aria-label="Upload image"
              role="button"
              tabIndex={0}
            />
          </CldUploadButton>
        )}
        <form
          ref={formRef}
          onSubmit={handleSubmit(onSubmit)}
          className="flex w-full items-center gap-2 lg:gap-4"
          aria-label={isAI ? "AI chat message form" : "Send message form"}
        >
          <MessageInput
            id="message"
            register={register}
            errors={errors}
            required
            placeholder={isAI ? "Ask me anything..." : "Write a message"}
            onInputChange={handleInputChange}
            onModifierEnter={handleModifierEnterSubmit}
          />

          {/* Voice Input Button */}
          {enableVoiceInput && voiceSupported && (
            <VoiceInput
              onTranscriptApply={handleVoiceTranscript}
              currentText={currentMessage}
              showWaveform={false}
              showLanguageSelector={false}
              showPreview
              defaultMode="append"
              buttonSize="md"
              enableShortcut
              disabled={isLoading || isStreaming}
              onStateChange={handleVoiceStateChange}
              onError={handleVoiceError}
            />
          )}

          <button
            type="submit"
            disabled={isLoading || isStreaming}
            aria-label={isAI ? "Send message to AI" : "Send message"}
            aria-busy={isLoading || isStreaming}
            aria-disabled={isLoading || isStreaming}
            className={`
              cursor-pointer
              rounded-full
              ${isAI ? "bg-gradient-to-r from-purple-500 to-pink-500" : "bg-sky-500"}
              p-2
              transition
              ${isAI ? "hover:opacity-75" : "hover:bg-sky-600"}
              ${isLoading || isStreaming ? "cursor-not-allowed opacity-50" : ""}
            `}
          >
            <HiPaperAirplane
              size={18}
              className={`text-white ${isStreaming ? "animate-pulse" : ""}`}
              aria-hidden="true"
            />
          </button>
        </form>
      </div>
    </div>
  )
}

export default Form
