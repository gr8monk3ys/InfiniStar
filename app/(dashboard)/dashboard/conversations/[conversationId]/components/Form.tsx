"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useForm, type FieldValues } from "react-hook-form"
import toast from "react-hot-toast"

import useConversation from "@/app/(dashboard)/dashboard/hooks/useConversation"
import useImageGeneration from "@/app/(dashboard)/dashboard/hooks/useImageGeneration"
import useVoiceRecording from "@/app/(dashboard)/dashboard/hooks/useVoiceRecording"
import { isVoiceInputSupported, type VoiceInputMode } from "@/app/components/voice"
import { useAiChatStream, type TokenUsage } from "@/app/hooks/useAiChatStream"
import { useCsrfToken } from "@/app/hooks/useCsrfToken"
import { useSuggestionPreferences, useSuggestions } from "@/app/hooks/useSuggestions"
import { useTokenUsageStore } from "@/app/hooks/useTokenUsage"
import { useTypingIndicator } from "@/app/hooks/useTypingIndicator"
import { type FullMessageType } from "@/app/types"

import { FormPanel } from "./FormPanel"
import { type ImageSize } from "./ImageGenerationDialog"
import { useMessageSubmit } from "./useMessageSubmit"

const EMPTY_MESSAGES: FullMessageType[] = []

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
  /** Current signed-in user ID (Prisma UUID) for typing indicator + UI behavior */
  currentUserId?: string | null
}

const Form: React.FC<FormProps> = ({
  isAI = false,
  enableStreaming = true,
  _onTypingChange,
  onAIStreamingChange,
  enableVoiceInput = true,
  messages = EMPTY_MESSAGES,
  currentUserId,
}) => {
  const { conversationId } = useConversation()
  const [isLoading, setIsLoading] = useState(false)
  const [pendingImage, setPendingImage] = useState<string | null>(null)
  const { token: csrfToken } = useCsrfToken()
  const viewerId = currentUserId ?? undefined
  const voiceSupported = isVoiceInputSupported()
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
  const { emitTyping } = useTypingIndicator({
    conversationId,
    currentUserId: viewerId,
  })
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const setLatestUsage = useTokenUsageStore((state) => state.setLatestUsage)
  const { sendMessage: sendStreamingMessage, isStreaming } = useAiChatStream({
    conversationId,
    csrfToken,
    onComplete: (_messageId: string, usage?: TokenUsage) => {
      toast.success("AI response complete")
      if (usage) {
        setLatestUsage(usage, conversationId)
      }
    },
    onError: (error) => {
      toast.error(`AI error: ${error}`)
    },
  })
  useEffect(() => {
    onAIStreamingChange?.(isStreaming)
  }, [isStreaming, onAIStreamingChange])
  const {
    isRecordingVoiceMessage,
    isSendingVoiceMessage,
    voiceMessageSupported,
    toggleVoiceMessageRecording,
  } = useVoiceRecording({
    conversationId,
    csrfToken,
    isAI,
    enableStreaming,
    sendStreamingMessage,
  })
  const {
    isGeneratingImage,
    imageGenOpen,
    imageGenPrompt,
    imageGenSize,
    setImageGenOpen,
    setImageGenPrompt,
    setImageGenSize,
    handleGenerateImage,
  } = useImageGeneration({ conversationId, csrfToken })
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
  const currentMessage = watch("message")
  const formRef = useRef<HTMLFormElement>(null)
  const handleSuggestionSelect = useCallback(
    (text: string) => {
      const currentValue = getValues("message") || ""
      const newValue = currentValue.trim() ? `${currentValue.trim()} ${text}` : text
      setValue("message", newValue, { shouldValidate: true })
      clearSuggestions()
      setShowSuggestions(false)
      setTimeout(() => setShowSuggestions(true), 1000)
    },
    [getValues, setValue, clearSuggestions]
  )
  const handleSuggestionsDismiss = useCallback(() => {
    clearSuggestions()
    setShowSuggestions(false)
    setTimeout(() => setShowSuggestions(true), 30000)
  }, [clearSuggestions])
  const handleModifierEnterSubmit = useCallback(() => {
    const values = getValues()
    if (values.message && values.message.trim() && formRef.current) {
      formRef.current.requestSubmit()
    }
  }, [getValues])
  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (isAI) return
      const hasContent = e.target.value.length > 0
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current)
      }
      if (hasContent) {
        emitTyping(true)
        typingTimeoutRef.current = setTimeout(() => {
          emitTyping(false)
        }, 3000)
      } else {
        emitTyping(false)
      }
    },
    [isAI, emitTyping]
  )
  const handleVoiceTranscript = useCallback(
    (transcript: string, mode: VoiceInputMode) => {
      const currentValue = getValues("message") || ""
      if (mode === "append") {
        const newValue = currentValue ? `${currentValue} ${transcript}` : transcript
        setValue("message", newValue, { shouldValidate: true })
      } else {
        setValue("message", transcript, { shouldValidate: true })
      }
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
  const handleVoiceStateChange = useCallback(
    (state: "idle" | "listening" | "processing" | "error") => {
      if (!isAI && state === "listening") {
        emitTyping(true)
      }
    },
    [isAI, emitTyping]
  )
  const handleVoiceError = useCallback((error: string, message: string) => {
    if (error !== "aborted") {
      toast.error(message)
    }
  }, [])
  const handleVoiceMessageToggle = useCallback(() => {
    toggleVoiceMessageRecording().catch(() => {})
  }, [toggleVoiceMessageRecording])
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current)
      }
    }
  }, [])
  const { onSubmit, handleUpload } = useMessageSubmit({
    csrfToken,
    pendingImage,
    isAI,
    enableStreaming,
    sendStreamingMessage,
    conversationId,
    emitTyping,
    typingTimeoutRef,
    setValue,
    setPendingImage,
    setIsLoading,
  })
  const shouldShowSuggestions =
    isAI &&
    suggestionsEnabled &&
    showSuggestions &&
    (suggestions.length > 0 || suggestionsLoading) &&
    currentMessage.length === 0
  const canSubmit =
    (isAI ? Boolean(currentMessage.trim() || pendingImage) : Boolean(currentMessage.trim())) &&
    !isLoading &&
    !isStreaming
  const handleFormSubmit = handleSubmit(onSubmit)

  return (
    <FormPanel
      isAI={isAI}
      shouldShowSuggestions={shouldShowSuggestions}
      suggestions={suggestions}
      suggestionsLoading={suggestionsLoading}
      onSuggestionSelect={handleSuggestionSelect}
      onSuggestionsRefresh={refreshSuggestions}
      onSuggestionsDismiss={handleSuggestionsDismiss}
      isLoading={isLoading}
      isStreaming={isStreaming}
      pendingImage={pendingImage}
      onRemovePendingImage={() => setPendingImage(null)}
      onUpload={handleUpload}
      onOpenImageGenerator={() => setImageGenOpen(true)}
      voiceMessageSupported={voiceMessageSupported}
      isGeneratingImage={isGeneratingImage}
      isSendingVoiceMessage={isSendingVoiceMessage}
      isRecordingVoiceMessage={isRecordingVoiceMessage}
      onVoiceMessageToggle={handleVoiceMessageToggle}
      formRef={formRef}
      onSubmit={handleFormSubmit}
      register={register}
      errors={errors}
      onInputChange={handleInputChange}
      onModifierEnterSubmit={handleModifierEnterSubmit}
      enableVoiceInput={enableVoiceInput}
      voiceSupported={voiceSupported}
      onTranscriptApply={handleVoiceTranscript}
      currentMessage={currentMessage}
      onStateChange={handleVoiceStateChange}
      onVoiceError={handleVoiceError}
      canSubmit={canSubmit}
      imageGenOpen={imageGenOpen}
      onImageGenOpenChange={(open) => {
        setImageGenOpen(open)
        if (!open) {
          setImageGenPrompt("")
          setImageGenSize("1024x1024")
        }
      }}
      imageGenPrompt={imageGenPrompt}
      imageGenSize={imageGenSize as ImageSize}
      onImagePromptChange={setImageGenPrompt}
      onImageSizeChange={setImageGenSize}
      onImageGenerate={handleGenerateImage}
    />
  )
}

export default Form
