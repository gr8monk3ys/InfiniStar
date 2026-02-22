"use client"

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type BaseSyntheticEvent,
  type ChangeEvent,
  type RefObject,
} from "react"
import dynamic from "next/dynamic"
import Image from "next/image"
import type { CloudinaryUploadWidgetResults } from "next-cloudinary"
import { useForm, type FieldValues, type SubmitHandler } from "react-hook-form"
import toast from "react-hot-toast"
import {
  HiMicrophone,
  HiPaperAirplane,
  HiPhoto,
  HiSparkles,
  HiStopCircle,
  HiXMark,
} from "react-icons/hi2"

import { api, ApiError } from "@/app/lib/api-client"
import { Button } from "@/app/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/app/components/ui/dialog"
import useConversation from "@/app/(dashboard)/dashboard/hooks/useConversation"
import useImageGeneration from "@/app/(dashboard)/dashboard/hooks/useImageGeneration"
import useVoiceRecording from "@/app/(dashboard)/dashboard/hooks/useVoiceRecording"
import { SuggestionChips } from "@/app/components/suggestions"
import { isVoiceInputSupported, VoiceInput, type VoiceInputMode } from "@/app/components/voice"
import { useAiChatStream, type TokenUsage } from "@/app/hooks/useAiChatStream"
import { useCsrfToken } from "@/app/hooks/useCsrfToken"
import {
  useSuggestionPreferences,
  useSuggestions,
  type Suggestion,
} from "@/app/hooks/useSuggestions"
import { useTokenUsageStore } from "@/app/hooks/useTokenUsage"
import { useTypingIndicator } from "@/app/hooks/useTypingIndicator"
import { type FullMessageType } from "@/app/types"

import MessageInput from "./MessageInput"

// Dynamic import to avoid build-time Cloudinary validation
const CldUploadButton = dynamic(
  () => import("next-cloudinary").then((mod) => mod.CldUploadButton),
  { ssr: false }
)
const hasCloudinaryConfig = Boolean(process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME)
const EMPTY_MESSAGES: FullMessageType[] = []

type ImageSize = "512x512" | "1024x1024" | "1024x1792" | "1792x1024"

interface PendingImagePreviewProps {
  pendingImage: string
  onRemove: () => void
}

function PendingImagePreview({ pendingImage, onRemove }: PendingImagePreviewProps) {
  return (
    <div className="mx-4 mt-2 flex items-start gap-3 rounded-lg border border-border/70 bg-muted/40 p-3">
      <Image
        src={pendingImage}
        alt="Pending prompt upload"
        width={56}
        height={56}
        className="size-14 rounded-md border border-border object-cover"
      />
      <div className="flex min-w-0 flex-1 items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">Image will be sent with your next prompt.</p>
        <button
          type="button"
          className="rounded-full p-1 text-muted-foreground transition hover:bg-accent hover:text-foreground"
          onClick={onRemove}
          aria-label="Remove pending image"
        >
          <HiXMark size={16} />
        </button>
      </div>
    </div>
  )
}

interface ImageGenerationDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  prompt: string
  size: ImageSize
  onPromptChange: (value: string) => void
  onSizeChange: (value: ImageSize) => void
  onGenerate: () => void
  isGenerating: boolean
  isStreaming: boolean
}

function ImageGenerationDialog({
  open,
  onOpenChange,
  prompt,
  size,
  onPromptChange,
  onSizeChange,
  onGenerate,
  isGenerating,
  isStreaming,
}: ImageGenerationDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Generate image</DialogTitle>
          <DialogDescription>
            Creates an AI-generated image and sends it to this conversation.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <label className="block text-sm font-medium text-foreground" htmlFor="image-prompt">
            Prompt
          </label>
          <textarea
            id="image-prompt"
            value={prompt}
            onChange={(e) => onPromptChange(e.target.value)}
            placeholder="Describe the image you want..."
            className="min-h-28 w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            maxLength={2000}
            disabled={isGenerating || isStreaming}
          />

          <label className="block text-sm font-medium text-foreground" htmlFor="image-size">
            Size
          </label>
          <select
            id="image-size"
            value={size}
            onChange={(e) => onSizeChange(e.target.value as ImageSize)}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            disabled={isGenerating || isStreaming}
          >
            <option value="512x512">512x512</option>
            <option value="1024x1024">1024x1024</option>
            <option value="1024x1792">1024x1792</option>
            <option value="1792x1024">1792x1024</option>
          </select>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isGenerating}
          >
            Cancel
          </Button>
          <Button type="button" onClick={onGenerate} disabled={isGenerating || isStreaming}>
            {isGenerating ? "Generating..." : "Generate"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

interface ComposerRowProps {
  isAI: boolean
  onUpload: (result: CloudinaryUploadWidgetResults) => void
  onOpenImageGenerator: () => void
  isLoading: boolean
  isStreaming: boolean
  voiceMessageSupported: boolean
  isGeneratingImage: boolean
  isSendingVoiceMessage: boolean
  isRecordingVoiceMessage: boolean
  onVoiceMessageToggle: () => void
  formRef: RefObject<HTMLFormElement | null>
  onSubmit: (event?: BaseSyntheticEvent) => void
  register: ReturnType<typeof useForm<FieldValues>>["register"]
  errors: ReturnType<typeof useForm<FieldValues>>["formState"]["errors"]
  onInputChange: (e: ChangeEvent<HTMLInputElement>) => void
  onModifierEnterSubmit: () => void
  enableVoiceInput: boolean
  voiceSupported: boolean
  onTranscriptApply: (transcript: string, mode: VoiceInputMode) => void
  currentMessage: string
  onStateChange: (state: "idle" | "listening" | "processing" | "error") => void
  onVoiceError: (error: string, message: string) => void
  canSubmit: boolean
}

function ComposerRow({
  isAI,
  onUpload,
  onOpenImageGenerator,
  isLoading,
  isStreaming,
  voiceMessageSupported,
  isGeneratingImage,
  isSendingVoiceMessage,
  isRecordingVoiceMessage,
  onVoiceMessageToggle,
  formRef,
  onSubmit,
  register,
  errors,
  onInputChange,
  onModifierEnterSubmit,
  enableVoiceInput,
  voiceSupported,
  onTranscriptApply,
  currentMessage,
  onStateChange,
  onVoiceError,
  canSubmit,
}: ComposerRowProps) {
  return (
    <div className="flex w-full items-center gap-2 p-4">
      {hasCloudinaryConfig ? (
        <CldUploadButton
          options={{ maxFiles: 1 }}
          onUpload={onUpload}
          uploadPreset="pgc9ehd5"
          aria-label="Attach image"
        >
          <HiPhoto size={30} className="text-sky-500" aria-hidden="true" />
        </CldUploadButton>
      ) : (
        <button
          type="button"
          disabled
          aria-label="Attach image unavailable"
          title="Image upload is unavailable until Cloudinary is configured."
          className="cursor-not-allowed rounded-md p-1 opacity-60"
        >
          <HiPhoto size={30} className="text-sky-500" aria-hidden="true" />
        </button>
      )}
      {isAI && (
        <button
          type="button"
          onClick={onOpenImageGenerator}
          disabled={isLoading || isStreaming}
          className="rounded-md p-1 text-violet-600 transition hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
          aria-label="Generate image"
          title="Generate image"
        >
          <HiSparkles size={26} />
        </button>
      )}
      {voiceMessageSupported && (
        <button
          type="button"
          onClick={onVoiceMessageToggle}
          disabled={isLoading || isStreaming || isGeneratingImage || isSendingVoiceMessage}
          className={`rounded-md p-1 transition hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50 ${
            isRecordingVoiceMessage ? "text-red-600" : "text-sky-600"
          }`}
          aria-label={
            isRecordingVoiceMessage ? "Stop voice message recording" : "Record voice message"
          }
          aria-pressed={isRecordingVoiceMessage}
          title={isRecordingVoiceMessage ? "Stop recording" : "Record voice message"}
        >
          {isRecordingVoiceMessage ? <HiStopCircle size={26} /> : <HiMicrophone size={26} />}
        </button>
      )}
      <form
        ref={formRef}
        onSubmit={onSubmit}
        className="flex w-full items-center gap-2 lg:gap-4"
        aria-label={isAI ? "AI chat message form" : "Send message form"}
      >
        <MessageInput
          id="message"
          register={register}
          errors={errors}
          required={!isAI}
          placeholder={isAI ? "Ask me anything..." : "Write a message"}
          aria-label="Message"
          onInputChange={onInputChange}
          onModifierEnter={onModifierEnterSubmit}
        />

        {enableVoiceInput && voiceSupported && (
          <VoiceInput
            onTranscriptApply={onTranscriptApply}
            currentText={currentMessage}
            showWaveform={false}
            showLanguageSelector={false}
            showPreview
            defaultMode="append"
            buttonSize="md"
            enableShortcut
            disabled={isLoading || isStreaming}
            onStateChange={onStateChange}
            onError={onVoiceError}
          />
        )}

        <button
          type="submit"
          disabled={!canSubmit}
          aria-label={isAI ? "Send message to AI" : "Send message"}
          aria-busy={isLoading || isStreaming}
          aria-disabled={!canSubmit}
          className={`
              cursor-pointer
              rounded-full
              ${isAI ? "bg-gradient-to-r from-purple-500 to-pink-500" : "bg-sky-500"}
              p-2
              transition
              ${isAI ? "hover:opacity-75" : "hover:bg-sky-600"}
              ${!canSubmit ? "cursor-not-allowed opacity-50" : ""}
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
  )
}

interface FormPanelProps {
  isAI: boolean
  shouldShowSuggestions: boolean
  suggestions: Suggestion[]
  suggestionsLoading: boolean
  onSuggestionSelect: (text: string) => void
  onSuggestionsRefresh: () => void
  onSuggestionsDismiss: () => void
  isLoading: boolean
  isStreaming: boolean
  pendingImage: string | null
  onRemovePendingImage: () => void
  onUpload: (result: CloudinaryUploadWidgetResults) => void
  onOpenImageGenerator: () => void
  voiceMessageSupported: boolean
  isGeneratingImage: boolean
  isSendingVoiceMessage: boolean
  isRecordingVoiceMessage: boolean
  onVoiceMessageToggle: () => void
  formRef: RefObject<HTMLFormElement | null>
  onSubmit: (event?: BaseSyntheticEvent) => void
  register: ComposerRowProps["register"]
  errors: ComposerRowProps["errors"]
  onInputChange: (e: ChangeEvent<HTMLInputElement>) => void
  onModifierEnterSubmit: () => void
  enableVoiceInput: boolean
  voiceSupported: boolean
  onTranscriptApply: (transcript: string, mode: VoiceInputMode) => void
  currentMessage: string
  onStateChange: (state: "idle" | "listening" | "processing" | "error") => void
  onVoiceError: (error: string, message: string) => void
  canSubmit: boolean
  imageGenOpen: boolean
  onImageGenOpenChange: (open: boolean) => void
  imageGenPrompt: string
  imageGenSize: ImageSize
  onImagePromptChange: (value: string) => void
  onImageSizeChange: (value: ImageSize) => void
  onImageGenerate: () => void
}

function FormPanel({
  isAI,
  shouldShowSuggestions,
  suggestions,
  suggestionsLoading,
  onSuggestionSelect,
  onSuggestionsRefresh,
  onSuggestionsDismiss,
  isLoading,
  isStreaming,
  pendingImage,
  onRemovePendingImage,
  onUpload,
  onOpenImageGenerator,
  voiceMessageSupported,
  isGeneratingImage,
  isSendingVoiceMessage,
  isRecordingVoiceMessage,
  onVoiceMessageToggle,
  formRef,
  onSubmit,
  register,
  errors,
  onInputChange,
  onModifierEnterSubmit,
  enableVoiceInput,
  voiceSupported,
  onTranscriptApply,
  currentMessage,
  onStateChange,
  onVoiceError,
  canSubmit,
  imageGenOpen,
  onImageGenOpenChange,
  imageGenPrompt,
  imageGenSize,
  onImagePromptChange,
  onImageSizeChange,
  onImageGenerate,
}: FormPanelProps) {
  return (
    <div
      className="w-full border-t border-border bg-background"
      role="region"
      aria-label="Message input area"
    >
      {shouldShowSuggestions && (
        <div className="px-4 pt-2">
          <SuggestionChips
            suggestions={suggestions}
            onSelect={onSuggestionSelect}
            isLoading={suggestionsLoading}
            onRefresh={onSuggestionsRefresh}
            onDismiss={onSuggestionsDismiss}
            disabled={isLoading || isStreaming}
          />
        </div>
      )}
      {isAI && pendingImage && (
        <PendingImagePreview pendingImage={pendingImage} onRemove={onRemovePendingImage} />
      )}
      <ComposerRow
        isAI={isAI}
        onUpload={onUpload}
        onOpenImageGenerator={onOpenImageGenerator}
        isLoading={isLoading}
        isStreaming={isStreaming}
        voiceMessageSupported={voiceMessageSupported}
        isGeneratingImage={isGeneratingImage}
        isSendingVoiceMessage={isSendingVoiceMessage}
        isRecordingVoiceMessage={isRecordingVoiceMessage}
        onVoiceMessageToggle={onVoiceMessageToggle}
        formRef={formRef}
        onSubmit={onSubmit}
        register={register}
        errors={errors}
        onInputChange={onInputChange}
        onModifierEnterSubmit={onModifierEnterSubmit}
        enableVoiceInput={enableVoiceInput}
        voiceSupported={voiceSupported}
        onTranscriptApply={onTranscriptApply}
        currentMessage={currentMessage}
        onStateChange={onStateChange}
        onVoiceError={onVoiceError}
        canSubmit={canSubmit}
      />
      {isAI && (
        <ImageGenerationDialog
          open={imageGenOpen}
          onOpenChange={onImageGenOpenChange}
          prompt={imageGenPrompt}
          size={imageGenSize}
          onPromptChange={onImagePromptChange}
          onSizeChange={onImageSizeChange}
          onGenerate={onImageGenerate}
          isGenerating={isGeneratingImage}
          isStreaming={isStreaming}
        />
      )}
    </div>
  )
}

interface UseMessageSubmitHandlersParams {
  csrfToken: string | null | undefined
  pendingImage: string | null
  isAI: boolean
  enableStreaming: boolean
  sendStreamingMessage: (payload: { message?: string; image?: string }) => Promise<boolean>
  conversationId: string
  emitTyping: (isTyping: boolean) => void
  typingTimeoutRef: { current: NodeJS.Timeout | null }
  setValue: ReturnType<typeof useForm<FieldValues>>["setValue"]
  setPendingImage: (value: string | null | ((prev: string | null) => string | null)) => void
  setIsLoading: (value: boolean | ((prev: boolean) => boolean)) => void
}

function useMessageSubmitHandlers({
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
}: UseMessageSubmitHandlersParams) {
  const onSubmit: SubmitHandler<FieldValues> = useCallback(
    async (data) => {
      if (!csrfToken) {
        toast.error("Security token not available. Please refresh the page.")
        return
      }
      const rawMessage = typeof data.message === "string" ? data.message : ""
      const trimmedMessage = rawMessage.trim()
      const queuedImage = pendingImage
      if (isAI && !trimmedMessage && !queuedImage) {
        toast.error("Add text or an image before sending")
        return
      }
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current)
      }
      emitTyping(false)
      setValue("message", "", { shouldValidate: true })
      if (isAI) {
        setPendingImage(null)
        if (enableStreaming) {
          const success = await sendStreamingMessage({
            message: trimmedMessage || undefined,
            image: queuedImage || undefined,
          })
          if (!success && queuedImage) {
            setPendingImage(queuedImage)
          }
        } else {
          setIsLoading(true)
          try {
            await api.post(
              "/api/ai/chat",
              {
                message: trimmedMessage || undefined,
                image: queuedImage || undefined,
                conversationId: conversationId,
              },
              { retries: 0, showErrorToast: false }
            )
          } catch (error) {
            if (queuedImage) {
              setPendingImage(queuedImage)
            }
            const message =
              error instanceof ApiError ? error.message : "Failed to send message to AI"
            toast.error(message)
          } finally {
            setIsLoading(false)
          }
        }
      } else {
        setIsLoading(true)
        try {
          await api.post(
            "/api/messages",
            { message: trimmedMessage, conversationId: conversationId },
            { retries: 1, showErrorToast: false }
          )
        } catch (error) {
          const message = error instanceof ApiError ? error.message : "Failed to send message"
          toast.error(message)
        } finally {
          setIsLoading(false)
        }
      }
    },
    [
      conversationId,
      csrfToken,
      emitTyping,
      enableStreaming,
      isAI,
      pendingImage,
      sendStreamingMessage,
      setIsLoading,
      setPendingImage,
      setValue,
      typingTimeoutRef,
    ]
  )

  const handleUpload = useCallback(
    (result: CloudinaryUploadWidgetResults) => {
      if (!csrfToken) {
        toast.error("Security token not available. Please refresh the page.")
        return
      }
      if (result.info && typeof result.info !== "string" && result.info.secure_url) {
        if (isAI) {
          setPendingImage(result.info.secure_url)
          toast.success("Image added to prompt")
        } else {
          api
            .post(
              "/api/messages",
              {
                image: result.info.secure_url,
                conversationId: conversationId,
              },
              { retries: 1, showErrorToast: false }
            )
            .catch((error: unknown) => {
              const message = error instanceof ApiError ? error.message : "Failed to upload image"
              toast.error(message)
            })
        }
      }
    },
    [conversationId, csrfToken, isAI, setPendingImage]
  )

  return { onSubmit, handleUpload }
}

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
  const { onSubmit, handleUpload } = useMessageSubmitHandlers({
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
