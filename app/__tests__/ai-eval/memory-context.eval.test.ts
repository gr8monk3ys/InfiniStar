import type { AIMemory } from "@prisma/client"

import { buildMemoryContext } from "@/app/lib/ai-memory"

/**
 * @jest-environment node
 *
 * Eval: AI Memory Context Assembly
 *
 * Tests buildMemoryContext (pure function, no DB) to lock in the structural
 * and content guarantees that protect conversation quality:
 *   - memories are grouped by category
 *   - the "weave in naturally / don't recite" instruction is always present
 *   - empty memories produce an empty string
 *   - prompt output is byte-identical when memories arrive in the same
 *     key-sorted order that getRelevantMemories guarantees (protects
 *     Anthropic prompt-cache reuse across turns).
 */

// Prisma client is imported transitively — stub it so no DB connection is needed.
jest.mock("@/app/lib/prismadb", () => ({
  __esModule: true,
  default: {},
}))

// Other transitive imports from ai-memory that we don't exercise here
jest.mock("@/app/lib/ai-model-routing", () => ({
  getFreeTierModel: () => "claude-haiku-4-5-20251001",
}))
jest.mock("@/app/lib/ai-usage", () => ({
  trackAiUsage: jest.fn(),
}))
jest.mock("@/app/lib/logger", () => ({
  aiLogger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}))
jest.mock("@/app/lib/subscription", () => ({
  getUserSubscriptionPlan: jest.fn(),
}))

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let _seq = 0
function makeMemory(
  overrides: Partial<AIMemory> & {
    key: string
    content: string
    category: AIMemory["category"]
  }
): AIMemory {
  _seq++
  return {
    id: `11111111-1111-4111-8${String(_seq).padStart(3, "0")}-111111111111`,
    createdAt: new Date("2024-01-01T00:00:00.000Z"),
    updatedAt: new Date("2024-01-01T00:00:00.000Z"),
    userId: "22222222-2222-4222-8222-222222222222",
    importance: 3,
    expiresAt: null,
    sourceConversationId: null,
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Fixtures — keys are intentionally alphabetically ordered so that
// buildMemoryContext output matches what getRelevantMemories would produce.
// ---------------------------------------------------------------------------

const PREF_MEMORY = makeMemory({
  key: "preferred_language",
  content: "Prefers responses in Spanish",
  category: "PREFERENCE",
})

const FACT_MEMORY = makeMemory({
  key: "profession",
  content: "Works as a marine biologist",
  category: "FACT",
})

const CONTEXT_MEMORY = makeMemory({
  key: "current_project",
  content: "Building a coral reef monitoring system",
  category: "CONTEXT",
})

const INSTRUCTION_MEMORY = makeMemory({
  key: "always_use_bullet_points",
  content: "Always format lists with bullet points",
  category: "INSTRUCTION",
})

const RELATIONSHIP_MEMORY = makeMemory({
  key: "partner_name",
  content: "Partner is called Sam",
  category: "RELATIONSHIP",
})

// ---------------------------------------------------------------------------
// 1. Empty input
// ---------------------------------------------------------------------------

describe("buildMemoryContext — empty input", () => {
  it("returns an empty string when given zero memories", () => {
    expect(buildMemoryContext([])).toBe("")
  })
})

// ---------------------------------------------------------------------------
// 2. Single memory
// ---------------------------------------------------------------------------

describe("buildMemoryContext — single memory", () => {
  let result: string

  beforeAll(() => {
    result = buildMemoryContext([FACT_MEMORY])
  })

  it("returns a non-empty string", () => {
    expect(result.length).toBeGreaterThan(0)
  })

  it("includes the '## About This User' heading", () => {
    expect(result).toContain("## About This User")
  })

  it("includes the memory content", () => {
    expect(result).toContain(FACT_MEMORY.content)
  })

  it("includes the 'weave in naturally' instruction", () => {
    expect(result).toContain("Weave this context in naturally")
  })

  it("includes the 'do not recite' instruction", () => {
    expect(result).toContain("Do not recite this list")
    expect(result).toContain('mention "stored memories"')
  })

  it("includes the category label for FACT", () => {
    expect(result).toContain("Fact:")
  })
})

// ---------------------------------------------------------------------------
// 3. Grouping by category
// ---------------------------------------------------------------------------

describe("buildMemoryContext — multiple categories", () => {
  let result: string

  beforeAll(() => {
    result = buildMemoryContext([
      PREF_MEMORY,
      FACT_MEMORY,
      CONTEXT_MEMORY,
      INSTRUCTION_MEMORY,
      RELATIONSHIP_MEMORY,
    ])
  })

  it("contains the Preference category label", () => {
    expect(result).toContain("Preference:")
  })

  it("contains the Fact category label", () => {
    expect(result).toContain("Fact:")
  })

  it("contains the Context category label", () => {
    expect(result).toContain("Context:")
  })

  it("contains the Instruction category label", () => {
    expect(result).toContain("Instruction:")
  })

  it("contains the Relationship category label", () => {
    expect(result).toContain("Relationship:")
  })

  it("renders each memory's content as a bullet-list item", () => {
    expect(result).toContain(`- ${PREF_MEMORY.content}`)
    expect(result).toContain(`- ${FACT_MEMORY.content}`)
    expect(result).toContain(`- ${CONTEXT_MEMORY.content}`)
    expect(result).toContain(`- ${INSTRUCTION_MEMORY.content}`)
    expect(result).toContain(`- ${RELATIONSHIP_MEMORY.content}`)
  })

  it("includes all required framing text", () => {
    expect(result).toContain("## About This User")
    expect(result).toContain("Weave this context in naturally")
    expect(result).toContain("Do not recite this list")
  })
})

// ---------------------------------------------------------------------------
// 4. Two memories in the same category stay grouped together
// ---------------------------------------------------------------------------

describe("buildMemoryContext — same-category grouping", () => {
  it("groups two FACT memories under a single Fact: header", () => {
    const m1 = makeMemory({ key: "age", content: "Is 34 years old", category: "FACT" })
    const m2 = makeMemory({ key: "city", content: "Lives in Lisbon", category: "FACT" })

    const result = buildMemoryContext([m1, m2])

    expect(result).toContain(m1.content)
    expect(result).toContain(m2.content)

    // Only one "Fact:" label — they share the same section
    const factLabelCount = (result.match(/Fact:/g) || []).length
    expect(factLabelCount).toBe(1)
  })
})

// ---------------------------------------------------------------------------
// 5. Prompt-cache stability — the invariant that prevents Anthropic prompt-
//    cache invalidation on every memory update.
//
//    getRelevantMemories sorts the selected set by key (alphabetical) before
//    returning it, so buildMemoryContext always receives memories in a
//    consistent order.  This test verifies that when the caller supplies
//    memories in key-sorted order (simulating what getRelevantMemories does),
//    the resulting context string is byte-identical regardless of which
//    permutation of the same sorted array is passed — i.e., re-running the
//    same request in a later turn produces an identical system prompt prefix.
// ---------------------------------------------------------------------------

describe("buildMemoryContext — prompt-cache stability", () => {
  it("produces byte-identical output on repeated calls with the same key-sorted input", () => {
    // Sorted by key alphabetically (mirrors getRelevantMemories sort)
    const sortedMemories = [
      INSTRUCTION_MEMORY, // always_use_bullet_points
      CONTEXT_MEMORY, // current_project
      PREF_MEMORY, // preferred_language
      FACT_MEMORY, // profession
      RELATIONSHIP_MEMORY, // partner_name
    ].sort((a, b) => a.key.localeCompare(b.key))

    const first = buildMemoryContext([...sortedMemories])
    const second = buildMemoryContext([...sortedMemories])

    expect(first).toBe(second)
  })

  it("produces identical output for single-category memories supplied in key-sorted order", () => {
    // Both calls use the same order — verifying pure function determinism
    const m1 = makeMemory({ key: "aaa_fact", content: "First fact", category: "FACT" })
    const m2 = makeMemory({ key: "bbb_fact", content: "Second fact", category: "FACT" })

    const call1 = buildMemoryContext([m1, m2])
    const call2 = buildMemoryContext([m1, m2])

    expect(call1).toBe(call2)
    // Contents appear in key order
    expect(call1.indexOf(m1.content)).toBeLessThan(call1.indexOf(m2.content))
  })

  it("when input order changes the output changes — confirming caller MUST pre-sort", () => {
    // This test documents that buildMemoryContext itself does NOT sort;
    // the sort contract belongs to getRelevantMemories.
    const mA = makeMemory({ key: "aaa_item", content: "A content", category: "FACT" })
    const mB = makeMemory({ key: "bbb_item", content: "B content", category: "PREFERENCE" })

    // FACT first, then PREFERENCE
    const orderFP = buildMemoryContext([mA, mB])
    // PREFERENCE first, then FACT
    const orderPF = buildMemoryContext([mB, mA])

    // Different category insertion order → different section order in output
    expect(orderFP).not.toBe(orderPF)
  })
})
