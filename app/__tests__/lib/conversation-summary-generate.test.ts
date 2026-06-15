/**
 * @jest-environment node
 */

/**
 * Tests generateConversationSummary persistence behavior. Anthropic, Prisma, and
 * usage tracking are mocked — we only assert WHAT gets persisted, never hit the API.
 */
import { generateConversationSummary } from "@/app/lib/conversation-summary"

const mockFindUnique = jest.fn()
const mockUpdate = jest.fn()
const mockAnthropicCreate = jest.fn()
const mockTrackAiUsage = jest.fn()

jest.mock("@/app/lib/anthropic", () => ({
  __esModule: true,
  default: { messages: { create: (...args: unknown[]) => mockAnthropicCreate(...args) } },
}))

jest.mock("@/app/lib/prismadb", () => ({
  __esModule: true,
  default: {
    conversation: {
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
      update: (...args: unknown[]) => mockUpdate(...args),
    },
  },
}))

jest.mock("@/app/lib/ai-usage", () => ({
  trackAiUsage: (...args: unknown[]) => mockTrackAiUsage(...args),
}))

jest.mock("@/app/lib/logger", () => ({
  __esModule: true,
  aiLogger: { warn: jest.fn(), info: jest.fn(), error: jest.fn() },
}))

const conversationRow = {
  id: "conv-1",
  users: [{ name: "Alice", email: "alice@example.com" }],
  messages: [
    { body: "Hello", isAI: false, sender: { name: "Alice" } },
    { body: "Hi there", isAI: true, sender: null },
    { body: "How are you?", isAI: false, sender: { name: "Alice" } },
    { body: "Doing well", isAI: true, sender: null },
    { body: "Great", isAI: false, sender: { name: "Alice" } },
  ],
  _count: { messages: 5 },
}

beforeEach(() => {
  jest.clearAllMocks()
  mockFindUnique.mockResolvedValue(conversationRow)
  mockUpdate.mockResolvedValue({})
})

describe("generateConversationSummary persistence guard", () => {
  it("does not persist and returns null when the model returns empty content", async () => {
    // Anthropic returns no usable text → overview ends up blank.
    mockAnthropicCreate.mockResolvedValue({
      content: [],
      usage: { input_tokens: 120, output_tokens: 0 },
    })

    const result = await generateConversationSummary({
      conversationId: "conv-1",
      userId: "user-1",
      model: "claude-haiku-4-5",
      requestType: "summary",
    })

    expect(result).toBeNull()
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it("does not persist a summary whose parsed overview is blank", async () => {
    mockAnthropicCreate.mockResolvedValue({
      content: [{ type: "text", text: JSON.stringify({ overview: "   ", keyTopics: [] }) }],
      usage: { input_tokens: 120, output_tokens: 10 },
    })

    const result = await generateConversationSummary({
      conversationId: "conv-1",
      userId: "user-1",
      model: "claude-haiku-4-5",
      requestType: "summary",
    })

    expect(result).toBeNull()
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it("persists and returns the summary when the overview is non-blank", async () => {
    mockAnthropicCreate.mockResolvedValue({
      content: [
        {
          type: "text",
          text: JSON.stringify({
            overview: "Alice greeted the assistant and checked in.",
            keyTopics: ["greeting"],
            decisions: [],
            participants: ["Alice"],
          }),
        },
      ],
      usage: { input_tokens: 120, output_tokens: 30 },
    })

    const result = await generateConversationSummary({
      conversationId: "conv-1",
      userId: "user-1",
      model: "claude-haiku-4-5",
      requestType: "summary",
    })

    expect(result).not.toBeNull()
    expect(result?.summary.overview).toBe("Alice greeted the assistant and checked in.")
    expect(result?.messageCount).toBe(5)
    expect(mockUpdate).toHaveBeenCalledTimes(1)
  })
})
