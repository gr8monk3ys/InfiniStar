import { maybeAutoSummarize } from "@/app/lib/auto-summary"

/**
 * Tests the cadence gate of maybeAutoSummarize without hitting Anthropic.
 * generateConversationSummary is mocked so we only assert WHEN it fires.
 *
 * The gate is debt-based: it fires once at least AUTO_SUMMARY_INTERVAL new
 * (non-deleted) messages have accrued since the last stored summary. It must
 * NOT depend on the live count landing on an exact multiple — character chats
 * seed a greeting (count starts at 1) and add 2 messages per turn, so the count
 * is permanently odd and would never hit a multiple of 20.
 */
const mockGenerate = jest.fn().mockResolvedValue({
  summary: { overview: "x", keyTopics: [], decisions: [], participants: [] },
  messageCount: 20,
  generatedAt: new Date(),
})
const mockFindUnique = jest.fn()

jest.mock("@/app/lib/conversation-summary", () => ({
  generateConversationSummary: (...args: unknown[]) => mockGenerate(...args),
}))
jest.mock("@/app/lib/prismadb", () => ({
  __esModule: true,
  default: { conversation: { findUnique: (...args: unknown[]) => mockFindUnique(...args) } },
}))
jest.mock("@/app/lib/ai-model-routing", () => ({
  getFreeTierModel: () => "claude-haiku-4-5",
}))

/** Set the live non-deleted message count and the last summarized count. */
function setState(messageCount: number, summaryMessageCount: number | null) {
  mockFindUnique.mockResolvedValue({
    summaryMessageCount,
    _count: { messages: messageCount },
  })
}

describe("maybeAutoSummarize", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    delete process.env.AI_AUTO_SUMMARY_ENABLED
  })

  it("does not summarize below the minimum message count", async () => {
    setState(10, null)
    await maybeAutoSummarize("conv1", "user1")
    expect(mockGenerate).not.toHaveBeenCalled()
  })

  it("summarizes a greeting-seeded chat at an ODD count past the interval", async () => {
    // Greeting (1) + 10 turns (2 each) = 21 — never a multiple of 20.
    setState(21, null)
    await maybeAutoSummarize("conv1", "user1")
    expect(mockGenerate).toHaveBeenCalledWith(
      expect.objectContaining({
        conversationId: "conv1",
        userId: "user1",
        requestType: "summary-auto",
      })
    )
  })

  it("does not re-summarize until an interval of new messages accrues", async () => {
    // Last summary at 21; only 9 new messages since.
    setState(30, 21)
    await maybeAutoSummarize("conv1", "user1")
    expect(mockGenerate).not.toHaveBeenCalled()
  })

  it("summarizes again once an interval of new messages has accrued", async () => {
    // Last summary at 21; 20 new messages since (41 - 21).
    setState(41, 21)
    await maybeAutoSummarize("conv1", "user1")
    expect(mockGenerate).toHaveBeenCalled()
  })

  it("stays robust when a soft-delete shifts the count off a multiple of the interval", async () => {
    // Was 40, one message soft-deleted → 39, never summarized.
    setState(39, null)
    await maybeAutoSummarize("conv1", "user1")
    expect(mockGenerate).toHaveBeenCalled()
  })

  it("is disabled by an explicit falsy env flag", async () => {
    process.env.AI_AUTO_SUMMARY_ENABLED = "false"
    setState(40, null)
    await maybeAutoSummarize("conv1", "user1")
    expect(mockGenerate).not.toHaveBeenCalled()
  })
})
