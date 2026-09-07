/**
 * @jest-environment node
 */

/**
 * The Turn's contract.
 *
 * CONTEXT.md: a Turn is "the unit that must be assembled identically however it
 * was triggered". These tests are that sentence, made checkable. Every one of
 * them covers a way the four trigger sites previously disagreed.
 */

import {
  assembleTurn,
  buildPersonaContext,
  TURN_HISTORY_LIMIT,
  type TurnConversation,
} from "@/app/lib/turn"

const mockMessageFindMany = jest.fn()
const mockGetRelevantMemories = jest.fn()

jest.mock("@/app/lib/prismadb", () => ({
  __esModule: true,
  default: {
    message: {
      findMany: (...args: unknown[]) => mockMessageFindMany(...args),
    },
  },
}))

jest.mock("@/app/lib/ai-memory", () => ({
  getRelevantMemories: (...args: unknown[]) => mockGetRelevantMemories(...args),
  buildMemoryContext: (memories: { key: string; content: string }[]) =>
    `\n\n[Memories]\n${memories.map((m) => `${m.key}: ${m.content}`).join("\n")}`,
}))

jest.mock("@/app/lib/logger", () => ({
  __esModule: true,
  default: { child: jest.fn() },
  aiLogger: { warn: jest.fn(), error: jest.fn(), info: jest.fn() },
  apiLogger: { warn: jest.fn(), error: jest.fn(), info: jest.fn() },
  authLogger: { warn: jest.fn(), error: jest.fn(), info: jest.fn() },
  dbLogger: { warn: jest.fn(), error: jest.fn(), info: jest.fn() },
}))

const NOW = new Date("2026-02-01T12:00:00Z")

const CHARACTER_CONVERSATION: TurnConversation = {
  id: "conv-1",
  aiModel: null,
  aiPersonality: null,
  aiSystemPrompt: null,
  summary: null,
  character: {
    name: "Elara",
    systemPrompt: "You are Elara, a wandering archivist.",
    scenario: "A rain-soaked library at closing time.",
    exampleDialogues: "Elara: *shelves a book* You're late.",
  },
  persona: null,
}

beforeEach(() => {
  mockMessageFindMany.mockReset()
  mockMessageFindMany.mockResolvedValue([])
  mockGetRelevantMemories.mockReset()
  mockGetRelevantMemories.mockResolvedValue([])
})

describe("the recent-history window", () => {
  /**
   * The defect this module was written for. `/api/ai/regenerate` ordered
   * ascending with a `take`, which selects the *oldest* twenty messages, so past
   * twenty messages every Regeneration was assembled from the opening of the
   * conversation rather than from where it actually was.
   */
  it("selects the newest messages, not the oldest", async () => {
    await assembleTurn({
      conversation: CHARACTER_CONVERSATION,
      userId: "user-1",
      isPro: false,
      asOf: NOW,
    })

    const query = mockMessageFindMany.mock.calls[0][0]
    expect(query.orderBy).toEqual({ createdAt: "desc" })
    expect(query.take).toBe(TURN_HISTORY_LIMIT)
  })

  it("hands the model chronological order after selecting the newest", async () => {
    // Prisma returns newest-first for `orderBy: desc`.
    mockMessageFindMany.mockResolvedValue([
      { isAI: true, body: "third", image: null },
      { isAI: false, body: "second", image: null },
      { isAI: true, body: "first", image: null },
    ])

    const turn = await assembleTurn({
      conversation: CHARACTER_CONVERSATION,
      userId: "user-1",
      isPro: false,
      asOf: NOW,
    })

    expect(turn.messages.map((m) => m.content)).toEqual(["first", "second", "third"])
  })

  it("excludes soft-deleted messages", async () => {
    await assembleTurn({
      conversation: CHARACTER_CONVERSATION,
      userId: "user-1",
      isPro: false,
      asOf: NOW,
    })

    expect(mockMessageFindMany.mock.calls[0][0].where).toMatchObject({ isDeleted: false })
  })

  /**
   * A Regeneration replaces the most recent reply of an existing Turn, so it is
   * assembled from history as it stood immediately before that reply — the
   * model is asked the same question again, not a different one.
   */
  it("cuts history off before the reply being regenerated", async () => {
    const replyTime = new Date("2026-01-01T12:00:00Z")

    await assembleTurn({
      conversation: CHARACTER_CONVERSATION,
      userId: "user-1",
      isPro: false,
      asOf: replyTime,
    })

    expect(mockMessageFindMany.mock.calls[0][0].where).toMatchObject({
      createdAt: { lt: replyTime },
    })
  })

  /**
   * Both send routes persist the chatter's message *before* assembling, so an
   * unanchored history window picks that row up — and then `input` appends the
   * same content again. The model gets the newest message twice, one real
   * exchange falls out of the window, and the duplicate is billed as input.
   * Nothing errors, which is why `asOf` is required rather than optional.
   */
  it("never sends the anchored message twice, even though it is already persisted", async () => {
    const userMessageAt = new Date("2026-02-01T12:00:00Z")
    // What the database returns when the row has already been written: Prisma
    // would include it if the window were not anchored.
    mockMessageFindMany.mockResolvedValue([{ isAI: false, body: "earlier", image: null }])

    const turn = await assembleTurn({
      conversation: CHARACTER_CONVERSATION,
      userId: "user-1",
      isPro: false,
      asOf: userMessageAt,
      input: "the new thing",
    })

    expect(mockMessageFindMany.mock.calls[0][0].where.createdAt).toEqual({ lt: userMessageAt })
    expect(turn.messages).toEqual([
      { role: "user", content: "earlier" },
      { role: "user", content: "the new thing" },
    ])
    expect(turn.messages.filter((m) => m.content === "the new thing")).toHaveLength(1)
  })

  it("always anchors, so history is never taken as of an unspecified moment", async () => {
    await assembleTurn({
      conversation: CHARACTER_CONVERSATION,
      userId: "user-1",
      isPro: false,
      asOf: NOW,
    })

    expect(mockMessageFindMany.mock.calls[0][0].where.createdAt).toEqual({ lt: NOW })
  })
})

describe("the new input", () => {
  it("appends the chatter's input after the history", async () => {
    mockMessageFindMany.mockResolvedValue([{ isAI: true, body: "earlier", image: null }])

    const turn = await assembleTurn({
      conversation: CHARACTER_CONVERSATION,
      userId: "user-1",
      isPro: false,
      asOf: NOW,
      input: "and now this",
    })

    expect(turn.messages).toEqual([
      { role: "assistant", content: "earlier" },
      { role: "user", content: "and now this" },
    ])
  })

  /** A Regeneration "submits no new input and does not lengthen the conversation". */
  it("appends nothing when there is no new input", async () => {
    mockMessageFindMany.mockResolvedValue([{ isAI: false, body: "earlier", image: null }])

    const turn = await assembleTurn({
      conversation: CHARACTER_CONVERSATION,
      userId: "user-1",
      isPro: false,
      asOf: new Date(),
    })

    expect(turn.messages).toHaveLength(1)
  })
})

describe("memories", () => {
  /**
   * `/api/ai/chat` never imported the memory module. The only structural
   * difference between its assembly and `/api/ai/chat-stream`'s was this block,
   * and no test could see the difference because no module owned the assembly.
   */
  it("recalls the chatter's memories on every turn, however it was triggered", async () => {
    mockGetRelevantMemories.mockResolvedValue([{ key: "name", content: "goes by Sam" }])

    for (const args of [{ input: "hello" }, {}]) {
      mockGetRelevantMemories.mockClear()
      const turn = await assembleTurn({
        conversation: CHARACTER_CONVERSATION,
        userId: "user-1",
        isPro: false,
        asOf: NOW,
        ...args,
      })

      expect(mockGetRelevantMemories).toHaveBeenCalledWith("user-1")
      expect(JSON.stringify(turn.system)).toContain("goes by Sam")
    }
  })

  it("degrades the turn rather than failing it when memories cannot be read", async () => {
    mockGetRelevantMemories.mockRejectedValue(new Error("database is down"))

    const turn = await assembleTurn({
      conversation: CHARACTER_CONVERSATION,
      userId: "user-1",
      isPro: false,
      asOf: NOW,
      input: "hello",
    })

    expect(turn.system[0].text).toContain("Elara")
  })
})

describe("the prompt-cache split", () => {
  /**
   * The stable character-and-persona prefix carries the cache breakpoint;
   * volatile summary and memory text goes in a separate trailing block so
   * refreshing a summary or adding a Memory does not invalidate the cached
   * prefix.
   */
  it("puts the character and persona in the cached block and volatile text after it", async () => {
    mockGetRelevantMemories.mockResolvedValue([{ key: "name", content: "goes by Sam" }])

    const turn = await assembleTurn({
      conversation: {
        ...CHARACTER_CONVERSATION,
        // The stored summary is JSON, not prose — `renderSummaryForPrompt`
        // parses it and renders the overview.
        summary: JSON.stringify({ overview: "They met in the rain.", keyTopics: ["rain"] }),
        persona: {
          name: "Wren",
          description: "a courier",
          appearance: null,
          personalityTraits: null,
        },
      },
      userId: "user-1",
      isPro: false,
      asOf: NOW,
      input: "hello",
    })

    expect(turn.system).toHaveLength(2)
    expect(turn.system[0].cache_control).toEqual({ type: "ephemeral" })
    expect(turn.system[0].text).toContain("Elara")
    expect(turn.system[0].text).toContain("Wren")
    expect(turn.system[0].text).not.toContain("They met in the rain")

    expect(turn.system[1].cache_control).toBeUndefined()
    expect(turn.system[1].text).toContain("They met in the rain")
    expect(turn.system[1].text).toContain("goes by Sam")
  })

  it("emits a single block when there is nothing volatile", async () => {
    const turn = await assembleTurn({
      conversation: CHARACTER_CONVERSATION,
      userId: "user-1",
      isPro: false,
      asOf: NOW,
      input: "hello",
    })

    expect(turn.system).toHaveLength(1)
  })

  /**
   * Two Turns of the same conversation must produce a byte-identical stable
   * block, or the cached prefix is invalidated on every turn and the ~90%
   * input-token saving silently disappears.
   */
  it("produces a byte-identical stable block across turns", async () => {
    const args = {
      conversation: CHARACTER_CONVERSATION,
      userId: "user-1",
      isPro: false,
      asOf: NOW,
      input: "hello",
    }

    const first = await assembleTurn(args)
    const second = await assembleTurn(args)

    expect(first.system[0].text).toBe(second.system[0].text)
  })
})

describe("buildPersonaContext", () => {
  it("renders nothing when the conversation has no persona", () => {
    expect(buildPersonaContext(null)).toBe("")
  })

  it("omits the fields the persona did not fill in", () => {
    const rendered = buildPersonaContext({
      name: "Wren",
      description: null,
      appearance: null,
      personalityTraits: null,
    })

    expect(rendered).toContain("roleplaying as: Wren")
    expect(rendered).not.toContain("Description:")
    expect(rendered).not.toContain("Appearance:")
    expect(rendered).not.toContain("Personality:")
  })
})
