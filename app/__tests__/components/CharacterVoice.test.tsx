import { createRef, type ReactNode } from "react"
import { act, render, screen } from "@testing-library/react"

import {
  ComposerRow,
  type ComposerRowProps,
} from "@/app/(dashboard)/dashboard/conversations/[conversationId]/components/ComposerRow"
import TypingIndicator from "@/app/(dashboard)/dashboard/conversations/[conversationId]/components/TypingIndicator"
import { formatConversationTimestamp } from "@/app/(dashboard)/dashboard/conversations/components/ConversationBox"

/**
 * The chat must read as talking to a named character, not an assistant:
 * the typing line, the composer placeholder and the send button all carry
 * the character's name, and the list shows a relative day for older chats.
 */

jest.mock("@/app/hooks/useAiCapabilities", () => ({
  useAiCapabilities: () => ({
    capabilities: { imageGeneration: false, voiceTranscription: false },
    isLoaded: true,
  }),
}))

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
  VoiceInput: () => null,
}))

jest.mock("@/app/(dashboard)/dashboard/hooks/useOtherUser", () => ({
  __esModule: true,
  default: () => null,
}))

function buildComposerProps(overrides: Partial<ComposerRowProps> = {}): ComposerRowProps {
  return {
    isAI: true,
    onUpload: jest.fn(),
    onOpenImageGenerator: jest.fn(),
    isLoading: false,
    isStreaming: false,
    voiceMessageSupported: false,
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
    enableVoiceInput: false,
    voiceSupported: false,
    onTranscriptApply: jest.fn(),
    currentMessage: "",
    onStateChange: jest.fn(),
    onVoiceError: jest.fn(),
    canSubmit: true,
    ...overrides,
  }
}

describe("TypingIndicator", () => {
  beforeEach(() => {
    jest.useFakeTimers()
  })
  afterEach(() => {
    jest.useRealTimers()
  })

  it("names the character when it is writing", () => {
    render(<TypingIndicator isAITyping characterName="Elara" />)
    act(() => {
      jest.advanceTimersByTime(20)
    })
    expect(screen.getByText("Elara is writing...")).toBeInTheDocument()
  })

  it("keeps 'is typing' for people and does not double-announce", () => {
    const { container } = render(<TypingIndicator typingUsers={["Sam"]} />)
    act(() => {
      jest.advanceTimersByTime(20)
    })
    expect(screen.getByText("Sam is typing...")).toBeInTheDocument()
    // ConversationContainer owns the single live region for typing
    expect(container.querySelector("[aria-live]")).toBeNull()
    expect(container.querySelector("[role='status']")).toBeNull()
  })
})

describe("ComposerRow character voice", () => {
  it("addresses the character in the placeholder and send label", () => {
    render(<ComposerRow {...buildComposerProps({ characterName: "Elara" })} />)
    expect(screen.getByPlaceholderText("Say something to Elara")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Send message to Elara" })).toBeInTheDocument()
  })

  it("keeps a neutral placeholder for human chats", () => {
    render(<ComposerRow {...buildComposerProps({ isAI: false })} />)
    expect(screen.getByPlaceholderText("Write a message")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Send message" })).toBeInTheDocument()
  })

  it("does not use the hero gradient on the send button", () => {
    render(<ComposerRow {...buildComposerProps({ characterName: "Elara" })} />)
    const send = screen.getByRole("button", { name: "Send message to Elara" })
    expect(send.className).not.toContain("gradient-bg")
    expect(send.className).toContain("bg-primary")
  })
})

describe("formatConversationTimestamp", () => {
  const now = new Date(2026, 8, 3, 15, 0, 0) // Thu 3 Sep 2026, 15:00

  it("shows the time for today", () => {
    expect(formatConversationTimestamp(new Date(2026, 8, 3, 9, 5), now)).toMatch(/9:05/)
  })

  it("shows the weekday within the last week", () => {
    expect(formatConversationTimestamp(new Date(2026, 8, 1, 9, 5), now)).toBe("Tue")
  })

  it("shows a short date beyond a week", () => {
    expect(formatConversationTimestamp(new Date(2026, 7, 20, 9, 5), now)).toBe("20 Aug")
  })

  it("adds the year for older years", () => {
    expect(formatConversationTimestamp(new Date(2025, 11, 24, 9, 5), now)).toBe("24 Dec 2025")
  })
})

export {}
