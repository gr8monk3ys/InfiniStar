"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import dynamic from "next/dynamic"
import Image from "next/image"
import axios from "axios"
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
  /** Current signed-in user ID (Prisma UUID) for typing indicator + UI behavior */
  currentUserId?: string | null
}

const Form: React.FC<FormProps> = ({
  isAI = false,
  enableStreaming = true,
  _onTypingChange,
  onAIStreamingChange,
  enableVoiceInput = true,
  messages = [],
  currentUserId,
}) => {
  const { conversationId } = useConversation()
  const [isLoading, setIsLoading] = useState(false)
  const [pendingImage, setPendingImage] = useState<string | null>(null)
  const [imageGenOpen, setImageGenOpen] = useState(false)
  const [imageGenPrompt, setImageGenPrompt] = useState("")
  const [imageGenSize, setImageGenSize] = useState<
    "512x512" | "1024x1024" | "1024x1792" | "1792x1024"
  >("1024x1024")
  const [isGeneratingImage, setIsGeneratingImage] = useState(false)
  const [isRecordingVoiceMessage, setIsRecordingVoiceMessage] = useState(false)
  const [isSendingVoiceMessage, setIsSendingVoiceMessage] = useState(false)
  const { token: csrfToken } = useCsrfToken()
  const viewerId = currentUserId ?? undefined

  const voiceRecorderRef = useRef<MediaRecorder | null>(null)
  const voiceRecorderStreamRef = useRef<MediaStream | null>(null)
  const voiceChunksRef = useRef<Blob[]>([])

  // Check if voice input is supported
  const voiceSupported = isVoiceInputSupported()
  const voiceMessageSupported =
    typeof window !== "undefined" &&
    typeof navigator !== "undefined" &&
    Boolean(navigator.mediaDevices?.getUserMedia) &&
    typeof MediaRecorder !== "undefined"

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
    currentUserId: viewerId,
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

  const handleGenerateImage = useCallback(async () => {
    if (!csrfToken) {
      toast.error("Security token not available. Please refresh the page.")
      return
    }

    const prompt = imageGenPrompt.trim()
    if (!prompt) {
      toast.error("Enter an image prompt first")
      return
    }

    setIsGeneratingImage(true)
    const loader = toast.loading("Generating image...")

    try {
      const res = await fetch("/api/ai/image/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": csrfToken,
        },
        body: JSON.stringify({
          conversationId,
          prompt,
          size: imageGenSize,
        }),
      })

      const data = (await res.json().catch(() => null)) as { error?: string } | null
      if (!res.ok) {
        throw new Error(data?.error || "Failed to generate image")
      }

      toast.success("Image sent")
      setImageGenOpen(false)
      setImageGenPrompt("")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to generate image")
    } finally {
      toast.dismiss(loader)
      setIsGeneratingImage(false)
    }
  }, [conversationId, csrfToken, imageGenPrompt, imageGenSize])

  const cleanupVoiceRecorder = useCallback(() => {
    const recorder = voiceRecorderRef.current
    if (recorder) {
      // Prevent the "stop" handler from attempting an upload on teardown.
      recorder.onstop = null
      try {
        recorder.stop()
      } catch {
        // ignore
      }
    }
    voiceRecorderRef.current = null

    const stream = voiceRecorderStreamRef.current
    if (stream) {
      stream.getTracks().forEach((track) => track.stop())
    }
    voiceRecorderStreamRef.current = null
    voiceChunksRef.current = []
    setIsRecordingVoiceMessage(false)
  }, [])

  const handleVoiceMessageStop = useCallback(
    async (mimeType: string) => {
      if (!csrfToken) {
        toast.error("Security token not available. Please refresh the page.")
        cleanupVoiceRecorder()
        return
      }

      const chunks = voiceChunksRef.current
      voiceChunksRef.current = []

      const stream = voiceRecorderStreamRef.current
      if (stream) {
        stream.getTracks().forEach((track) => track.stop())
      }
      voiceRecorderStreamRef.current = null
      voiceRecorderRef.current = null

      const blob = new Blob(chunks, { type: mimeType || "audio/webm" })
      if (blob.size < 1024) {
        toast.error("Voice message too short")
        return
      }

      setIsSendingVoiceMessage(true)
      const loader = toast.loading("Sending voice message...")

      try {
        const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME
        const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET || "pgc9ehd5"
        if (!cloudName) {
          throw new Error("Cloudinary not configured")
        }

        const uploadForm = new FormData()
        uploadForm.append("file", blob, "voice-message.webm")
        uploadForm.append("upload_preset", uploadPreset)
        uploadForm.append("folder", "infinistar/voice")

        const uploadRes = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/video/upload`, {
          method: "POST",
          body: uploadForm,
        })
        const uploadJson = (await uploadRes.json().catch(() => null)) as {
          secure_url?: string
          url?: string
          error?: { message?: string }
        } | null

        const audioUrl = uploadJson?.secure_url ?? uploadJson?.url ?? null
        if (!uploadRes.ok || !audioUrl) {
          throw new Error(uploadJson?.error?.message || "Failed to upload voice message")
        }

        let transcript = ""
        try {
          const txRes = await fetch("/api/ai/transcribe", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-CSRF-Token": csrfToken,
            },
            body: JSON.stringify({ conversationId, audioUrl }),
          })
          if (txRes.ok) {
            const txJson = (await txRes.json().catch(() => null)) as { transcript?: string } | null
            transcript = typeof txJson?.transcript === "string" ? txJson.transcript : ""
          }
        } catch {
          // best-effort; audio messages can still be sent without transcript
        }

        const headers = {
          "X-CSRF-Token": csrfToken,
          "Content-Type": "application/json",
        }

        const transcriptTrimmed = transcript.trim()

        if (isAI) {
          if (transcriptTrimmed) {
            if (enableStreaming) {
              await sendStreamingMessage({
                message: transcriptTrimmed,
                audioUrl,
              })
            } else {
              await axios.post(
                "/api/ai/chat",
                {
                  message: transcriptTrimmed,
                  audioUrl,
                  conversationId,
                },
                { headers }
              )
            }
          } else {
            await axios.post(
              "/api/messages",
              {
                audioUrl,
                conversationId,
              },
              { headers }
            )
          }
        } else {
          await axios.post(
            "/api/messages",
            {
              message: transcriptTrimmed || undefined,
              audioUrl,
              audioTranscript: transcriptTrimmed || undefined,
              conversationId,
            },
            { headers }
          )
        }

        toast.success(
          transcriptTrimmed ? "Voice message sent" : "Voice message sent (no transcript)"
        )
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to send voice message")
      } finally {
        toast.dismiss(loader)
        setIsSendingVoiceMessage(false)
      }
    },
    [cleanupVoiceRecorder, conversationId, csrfToken, enableStreaming, isAI, sendStreamingMessage]
  )

  const toggleVoiceMessageRecording = useCallback(async () => {
    if (isSendingVoiceMessage) {
      return
    }

    if (isRecordingVoiceMessage) {
      try {
        voiceRecorderRef.current?.stop()
      } catch {
        cleanupVoiceRecorder()
      }
      setIsRecordingVoiceMessage(false)
      return
    }

    if (typeof window === "undefined") {
      return
    }

    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      toast.error("Voice messages are not supported in this browser.")
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      voiceRecorderStreamRef.current = stream
      voiceChunksRef.current = []

      const recorder = new MediaRecorder(stream)
      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          voiceChunksRef.current.push(event.data)
        }
      }
      recorder.onstop = () => {
        handleVoiceMessageStop(recorder.mimeType).catch(() => {
          // handled in function
        })
      }

      voiceRecorderRef.current = recorder
      recorder.start()
      setIsRecordingVoiceMessage(true)
      toast.success("Recording voice message...")
    } catch {
      toast.error("Microphone permission denied")
      cleanupVoiceRecorder()
    }
  }, [cleanupVoiceRecorder, handleVoiceMessageStop, isRecordingVoiceMessage, isSendingVoiceMessage])

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

  useEffect(() => {
    return () => {
      cleanupVoiceRecorder()
    }
  }, [cleanupVoiceRecorder])

  const onSubmit: SubmitHandler<FieldValues> = async (data) => {
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
      setPendingImage(null)

      // Use streaming for AI if enabled
      if (enableStreaming) {
        const success = await sendStreamingMessage({
          message: trimmedMessage || undefined,
          image: queuedImage || undefined,
        })
        if (!success && queuedImage) {
          setPendingImage(queuedImage)
        }
      } else {
        // Fallback to non-streaming endpoint
        setIsLoading(true)
        try {
          await axios.post(
            "/api/ai/chat",
            {
              message: trimmedMessage || undefined,
              image: queuedImage || undefined,
              conversationId: conversationId,
            },
            { headers }
          )
        } catch (error) {
          if (queuedImage) {
            setPendingImage(queuedImage)
          }
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
      if (isAI) {
        setPendingImage(result.info.secure_url)
        toast.success("Image added to prompt")
      } else {
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
  }

  // Hide suggestions when user is actively typing
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

      {isAI && pendingImage && (
        <div className="mx-4 mt-2 flex items-start gap-3 rounded-lg border border-border/70 bg-muted/40 p-3">
          <Image
            src={pendingImage}
            alt="Pending prompt upload"
            width={56}
            height={56}
            className="size-14 rounded-md border border-border object-cover"
          />
          <div className="flex min-w-0 flex-1 items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">
              Image will be sent with your next prompt.
            </p>
            <button
              type="button"
              className="rounded-full p-1 text-muted-foreground transition hover:bg-accent hover:text-foreground"
              onClick={() => setPendingImage(null)}
              aria-label="Remove pending image"
            >
              <HiXMark size={16} />
            </button>
          </div>
        </div>
      )}

      <div className="flex w-full items-center gap-2 p-4">
        <CldUploadButton options={{ maxFiles: 1 }} onUpload={handleUpload} uploadPreset="pgc9ehd5">
          <HiPhoto
            size={30}
            className="text-sky-500"
            aria-label="Upload image"
            role="button"
            tabIndex={0}
          />
        </CldUploadButton>
        {isAI && (
          <button
            type="button"
            onClick={() => setImageGenOpen(true)}
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
            onClick={() => {
              toggleVoiceMessageRecording().catch(() => {
                // handled in function
              })
            }}
            disabled={isLoading || isStreaming || isGeneratingImage || isSendingVoiceMessage}
            className={`rounded-md p-1 transition hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50 ${
              isRecordingVoiceMessage ? "text-red-600" : "text-sky-600"
            }`}
            aria-label={
              isRecordingVoiceMessage ? "Stop voice message recording" : "Record voice message"
            }
            title={isRecordingVoiceMessage ? "Stop recording" : "Record voice message"}
          >
            {isRecordingVoiceMessage ? <HiStopCircle size={26} /> : <HiMicrophone size={26} />}
          </button>
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
            required={!isAI}
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

      {isAI && (
        <Dialog
          open={imageGenOpen}
          onOpenChange={(open) => {
            setImageGenOpen(open)
            if (!open) {
              setImageGenPrompt("")
              setImageGenSize("1024x1024")
            }
          }}
        >
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
                value={imageGenPrompt}
                onChange={(e) => setImageGenPrompt(e.target.value)}
                placeholder="Describe the image you want..."
                className="min-h-28 w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                maxLength={2000}
                disabled={isGeneratingImage || isStreaming}
              />

              <label className="block text-sm font-medium text-foreground" htmlFor="image-size">
                Size
              </label>
              <select
                id="image-size"
                value={imageGenSize}
                onChange={(e) =>
                  setImageGenSize(
                    e.target.value as "512x512" | "1024x1024" | "1024x1792" | "1792x1024"
                  )
                }
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                disabled={isGeneratingImage || isStreaming}
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
                onClick={() => setImageGenOpen(false)}
                disabled={isGeneratingImage}
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleGenerateImage}
                disabled={isGeneratingImage || isStreaming}
              >
                {isGeneratingImage ? "Generating..." : "Generate"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}

export default Form
