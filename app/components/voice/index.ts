/**
 * Voice Input Components
 *
 * A collection of accessible, browser-compatible voice input components
 * using the Web Speech API.
 *
 * Browser Support:
 * - Chrome/Edge: Full support
 * - Safari: Partial support (iOS 14.5+, macOS Big Sur+)
 * - Firefox: Not supported
 *
 * @example
 * ```tsx
 * import { VoiceInput, VoiceInputButton, useVoiceInput } from '@/app/components/voice';
 *
 * // Full voice input with preview
 * <VoiceInput
 *   onTranscriptApply={(text) => setMessage(prev => prev + text)}
 *   showWaveform
 *   showPreview
 * />
 *
 * // Just the button
 * <VoiceInputButton
 *   voiceState={state}
 *   isSupported={isSupported}
 *   onClick={toggleListening}
 * />
 * ```
 */

// Main component
export {
  VoiceInput,
  VoiceInputMinimal,
  type VoiceInputProps,
  type VoiceInputMode,
} from "./VoiceInput"

// Sub-components
export { VoiceInputButton, type VoiceInputButtonProps } from "./VoiceInputButton"
export { VoiceWaveform, VoiceWaveformDots, type VoiceWaveformProps } from "./VoiceWaveform"
export {
  VoiceLanguageSelector,
  VoiceLanguageSelectorCompact,
  type VoiceLanguageSelectorProps,
} from "./VoiceLanguageSelector"
export { VoiceInputUnsupported, type VoiceInputUnsupportedProps } from "./VoiceInputUnsupported"

// Re-export hook and utilities
export {
  useVoiceInput,
  isVoiceInputSupported,
  getBrowserSupportInfo,
  VOICE_LANGUAGES,
  type VoiceInputState,
  type VoiceInputError,
  type VoiceLanguage,
  type UseVoiceInputOptions,
  type UseVoiceInputReturn,
} from "@/app/hooks/useVoiceInput"
