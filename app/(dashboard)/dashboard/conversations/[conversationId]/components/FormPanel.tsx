"use client"

import { type BaseSyntheticEvent, type ChangeEvent, type RefObject } from "react"
import type { CloudinaryUploadWidgetResults } from "next-cloudinary"

import { SuggestionChips } from "@/app/components/suggestions"
import { type VoiceInputMode } from "@/app/components/voice"
import { type Suggestion } from "@/app/hooks/useSuggestions"

import { ComposerRow, type ComposerRowProps } from "./ComposerRow"
import { ImageGenerationDialog, type ImageSize } from "./ImageGenerationDialog"
import { PendingImagePreview } from "./PendingImagePreview"

export interface FormPanelProps {
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

export function FormPanel({
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
