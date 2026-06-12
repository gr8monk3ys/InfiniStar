import { createRef, type ReactNode } from "react"
import { render, screen } from "@testing-library/react"

import {
  ComposerRow,
  type ComposerRowProps,
} from "@/app/(dashboard)/dashboard/conversations/[conversationId]/components/ComposerRow"
import type { AiCapabilities } from "@/app/hooks/useAiCapabilities"

const mockUseAiCapabilities = jest.fn<{ capabilities: AiCapabilities; isLoaded: boolean }, []>()

jest.mock("@/app/hooks/useAiCapabilities", () => ({
  useAiCapabilities: () => mockUseAiCapabilities(),
}))

// Stub the dynamically imported Cloudinary upload button.
jest.mock("next/dynamic", () => ({
  __esModule: true,
  default: () => {
    const MockDynamicComponent = (props: { children?: ReactNode; "aria-label"?: string }) => (
      <button type="button" aria-label={props["aria-label"]}>
        {props.children}
      </button>
    )
    return MockDynamicComponent
  },
}))

jest.mock("@/app/components/voice", () => ({
  VoiceInput: () => <button type="button" aria-label="Voice input" />,
}))

jest.mock(
  "@/app/(dashboard)/dashboard/conversations/[conversationId]/components/MessageInput",
  () => ({
    __esModule: true,
    default: () => <input aria-label="Message" />,
  })
)

function buildProps(overrides: Partial<ComposerRowProps> = {}): ComposerRowProps {
  return {
    isAI: true,
    onUpload: jest.fn(),
    onOpenImageGenerator: jest.fn(),
    isLoading: false,
    isStreaming: false,
    voiceMessageSupported: true,
    isGeneratingImage: false,
    isSendingVoiceMessage: false,
    isRecordingVoiceMessage: false,
    onVoiceMessageToggle: jest.fn(),
    formRef: createRef<HTMLFormElement>(),
    onSubmit: jest.fn(),
    register: jest.fn(() => ({})) as unknown as ComposerRowProps["register"],
    errors: {},
    onInputChange: jest.fn(),
    onModifierEnterSubmit: jest.fn(),
    enableVoiceInput: true,
    voiceSupported: true,
    onTranscriptApply: jest.fn(),
    currentMessage: "",
    onStateChange: jest.fn(),
    onVoiceError: jest.fn(),
    canSubmit: true,
    ...overrides,
  }
}

function setCapabilities(capabilities: AiCapabilities, isLoaded = true) {
  mockUseAiCapabilities.mockReturnValue({ capabilities, isLoaded })
}

describe("ComposerRow capability gating", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    setCapabilities({ imageGeneration: true, voiceTranscription: true })
  })

  it("shows image generation and voice buttons when all capabilities are available", () => {
    render(<ComposerRow {...buildProps()} />)

    expect(screen.getByRole("button", { name: /generate image/i })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /record voice message/i })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /voice input/i })).toBeInTheDocument()
  })

  it("hides the image generation button when imageGeneration capability is false", () => {
    setCapabilities({ imageGeneration: false, voiceTranscription: true })

    render(<ComposerRow {...buildProps()} />)

    expect(screen.queryByRole("button", { name: /generate image/i })).not.toBeInTheDocument()
    // Voice buttons are unaffected
    expect(screen.getByRole("button", { name: /record voice message/i })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /voice input/i })).toBeInTheDocument()
  })

  it("hides voice-message recording when voiceTranscription capability is false", () => {
    setCapabilities({ imageGeneration: true, voiceTranscription: false })

    render(<ComposerRow {...buildProps()} />)

    expect(screen.queryByRole("button", { name: /record voice message/i })).not.toBeInTheDocument()
    // Browser dictation uses the Web Speech API only — it stays available
    // regardless of server-side transcription configuration.
    expect(screen.getByRole("button", { name: /voice input/i })).toBeInTheDocument()
    // Image generation is unaffected
    expect(screen.getByRole("button", { name: /generate image/i })).toBeInTheDocument()
  })

  it("hides server-dependent features when nothing is configured", () => {
    setCapabilities({ imageGeneration: false, voiceTranscription: false })

    render(<ComposerRow {...buildProps()} />)

    expect(screen.queryByRole("button", { name: /generate image/i })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /record voice message/i })).not.toBeInTheDocument()
    // Browser dictation remains available; core composer still renders
    expect(screen.getByRole("button", { name: /voice input/i })).toBeInTheDocument()
    expect(screen.getByLabelText("Message")).toBeInTheDocument()
  })

  it("still respects existing gating: no image generation button outside AI chats", () => {
    render(<ComposerRow {...buildProps({ isAI: false })} />)

    expect(screen.queryByRole("button", { name: /generate image/i })).not.toBeInTheDocument()
  })

  it("still respects existing gating: no voice buttons without browser support", () => {
    render(<ComposerRow {...buildProps({ voiceMessageSupported: false, voiceSupported: false })} />)

    expect(screen.queryByRole("button", { name: /record voice message/i })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /voice input/i })).not.toBeInTheDocument()
  })

  it("keeps buttons visible while capabilities are still loading (optimistic default)", () => {
    setCapabilities({ imageGeneration: true, voiceTranscription: true }, false)

    render(<ComposerRow {...buildProps()} />)

    expect(screen.getByRole("button", { name: /generate image/i })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /record voice message/i })).toBeInTheDocument()
  })
})

export {}
