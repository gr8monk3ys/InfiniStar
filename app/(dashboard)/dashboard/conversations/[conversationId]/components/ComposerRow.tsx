"use client"

import { type BaseSyntheticEvent, type ChangeEvent, type RefObject } from "react"
import dynamic from "next/dynamic"
import type { CloudinaryUploadWidgetResults } from "next-cloudinary"
import { useForm, type FieldValues } from "react-hook-form"
import { HiMicrophone, HiPaperAirplane, HiPhoto, HiSparkles, HiStopCircle } from "react-icons/hi2"

import { VoiceInput, type VoiceInputMode } from "@/app/components/voice"

import MessageInput from "./MessageInput"

// Dynamic import to avoid build-time Cloudinary validation
const CldUploadButton = dynamic(
  () => import("next-cloudinary").then((mod) => mod.CldUploadButton),
  { ssr: false }
)
const hasCloudinaryConfig = Boolean(process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME)

export interface ComposerRowProps {
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

export function ComposerRow({
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
