"use client"

import { type BaseSyntheticEvent, type ChangeEvent, type RefObject } from "react"
import dynamic from "next/dynamic"
import type { CloudinaryUploadWidgetResults } from "next-cloudinary"
import { useForm, type FieldValues } from "react-hook-form"
import { HiMicrophone, HiPaperAirplane, HiPhoto, HiSparkles, HiStopCircle } from "react-icons/hi2"

import { VoiceInput, type VoiceInputMode } from "@/app/components/voice"
import { useAiCapabilities } from "@/app/hooks/useAiCapabilities"

import MessageInput from "./MessageInput"

// Dynamic import to avoid build-time Cloudinary validation
const CldUploadButton = dynamic(
  () => import("next-cloudinary").then((mod) => mod.CldUploadButton),
  { ssr: false }
)
const cloudinaryUploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET
const hasCloudinaryConfig = Boolean(
  process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME && cloudinaryUploadPreset
)

/** 44px tap target with a visible keyboard focus ring; shared by every composer icon button. */
const iconButtonClass =
  "inline-flex size-11 shrink-0 items-center justify-center rounded-full transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"

export interface ComposerRowProps {
  isAI: boolean
  /** Character name, used for the placeholder in character chats */
  characterName?: string | null
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

export function ComposerRow({
  isAI,
  characterName,
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
  // Server-reported AI media capabilities. Optimistically true while loading,
  // then buttons for unconfigured features (image generation, voice
  // transcription) are hidden so users never hit "not configured" errors.
  const { capabilities } = useAiCapabilities()

  const placeholder = isAI
    ? characterName
      ? `Say something to ${characterName}`
      : "Say something"
    : "Write a message"

  return (
    <div className="flex w-full items-center gap-1 p-3 sm:p-4">
      {hasCloudinaryConfig ? (
        <CldUploadButton
          options={{ maxFiles: 1 }}
          onUpload={onUpload}
          uploadPreset={cloudinaryUploadPreset}
          aria-label="Attach image"
          className={`${iconButtonClass} text-primary`}
        >
          <HiPhoto size={24} aria-hidden="true" />
        </CldUploadButton>
      ) : (
        <button
          type="button"
          disabled
          aria-label="Attach image unavailable"
          title="Image upload is unavailable until Cloudinary is configured."
          className={`${iconButtonClass} cursor-not-allowed text-primary opacity-60`}
        >
          <HiPhoto size={24} aria-hidden="true" />
        </button>
      )}
      {isAI && capabilities.imageGeneration && (
        <button
          type="button"
          onClick={onOpenImageGenerator}
          disabled={isLoading || isStreaming}
          className={`${iconButtonClass} text-primary hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50`}
          aria-label="Generate image"
          title="Generate image"
        >
          <HiSparkles size={24} />
        </button>
      )}
      {voiceMessageSupported && capabilities.voiceTranscription && (
        <button
          type="button"
          onClick={onVoiceMessageToggle}
          disabled={isLoading || isStreaming || isGeneratingImage || isSendingVoiceMessage}
          className={`${iconButtonClass} hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50 ${
            isRecordingVoiceMessage ? "text-destructive" : "text-primary"
          }`}
          aria-label={
            isRecordingVoiceMessage ? "Stop voice message recording" : "Record voice message"
          }
          aria-pressed={isRecordingVoiceMessage}
          title={isRecordingVoiceMessage ? "Stop recording" : "Record voice message"}
        >
          {isRecordingVoiceMessage ? <HiStopCircle size={24} /> : <HiMicrophone size={24} />}
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
          placeholder={placeholder}
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
          aria-label={isAI && characterName ? `Send message to ${characterName}` : "Send message"}
          aria-busy={isLoading || isStreaming}
          aria-disabled={!canSubmit}
          className={`${iconButtonClass} bg-primary text-primary-foreground hover:bg-primary/90 ${
            !canSubmit ? "cursor-not-allowed opacity-50" : "cursor-pointer"
          }`}
        >
          <HiPaperAirplane
            size={20}
            className={isStreaming ? "animate-pulse" : ""}
            aria-hidden="true"
          />
        </button>
      </form>
    </div>
  )
}
