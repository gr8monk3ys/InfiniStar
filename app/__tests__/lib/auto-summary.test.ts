import { maybeAutoSummarize } from "@/app/lib/auto-summary"

/**
 * Tests the cadence gate of maybeAutoSummarize without hitting Anthropic.
 * generateConversationSummary is mocked so we only assert WHEN it fires.
 */
const mockGenerate = jest.fn().mockResolvedValue({
  summary: { overview: "x", keyTopics: [], decisions: [], participants: [] },
  messageCount: 20,
  generatedAt: new Date(),
})
const mockCount = jest.fn()

jest.mock("@/app/lib/conversation-summary", () => ({
  generateConversationSummary: (...args: unknown[]) => mockGenerate(...args),
}))
jest.mock("@/app/lib/prismadb", () => ({
  __esModule: true,
  default: { message: { count: (...args: unknown[]) => mockCount(...args) } },
}))
jest.mock("@/app/lib/ai-model-routing", () => ({
  getFreeTierModel: () => "claude-haiku-4-5",
}))

describe("maybeAutoSummarize", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    delete process.env.AI_AUTO_SUMMARY_ENABLED
  })

  it("does not summarize below the minimum message count", async () => {
    mockCount.mockResolvedValue(10)
    await maybeAutoSummarize("conv1", "user1")
    expect(mockGenerate).not.toHaveBeenCalled()
  })

  it("does not summarize when not on an interval boundary", async () => {
    mockCount.mockResolvedValue(25)
    await maybeAutoSummarize("conv1", "user1")
    expect(mockGenerate).not.toHaveBeenCalled()
  })

  it("summarizes on an interval boundary at/after the minimum", async () => {
    mockCount.mockResolvedValue(40)
    await maybeAutoSummarize("conv1", "user1")
    expect(mockGenerate).toHaveBeenCalledWith(
      expect.objectContaining({
        conversationId: "conv1",
        userId: "user1",
        requestType: "summary-auto",
      })
    )
  })

  it("is disabled by an explicit falsy env flag", async () => {
    process.env.AI_AUTO_SUMMARY_ENABLED = "false"
    mockCount.mockResolvedValue(40)
    await maybeAutoSummarize("conv1", "user1")
    expect(mockGenerate).not.toHaveBeenCalled()
  })
})
