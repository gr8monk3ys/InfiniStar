/**
 * @jest-environment node
 *
 * Eval: AI Personality System Prompts
 *
 * Locks in the completeness and distinctness of all 8 personality presets so
 * that a blank or accidentally duplicated system prompt can't ship silently.
 * No live API calls — this is pure config inspection.
 */
import {
  AI_PERSONALITIES,
  getAllPersonalities,
  getSystemPrompt,
  isValidPersonality,
  type PersonalityType,
} from "@/app/lib/ai-personalities"

// ---------------------------------------------------------------------------
// 1. All 8 personalities are present and non-empty
// ---------------------------------------------------------------------------

const EXPECTED_PERSONALITY_IDS: PersonalityType[] = [
  "assistant",
  "creative",
  "technical",
  "friendly",
  "professional",
  "socratic",
  "concise",
  "custom",
]

describe("AI_PERSONALITIES registry", () => {
  it("contains exactly 8 personalities", () => {
    expect(Object.keys(AI_PERSONALITIES)).toHaveLength(8)
  })

  it("contains all expected personality IDs", () => {
    EXPECTED_PERSONALITY_IDS.forEach((id) => {
      expect(AI_PERSONALITIES).toHaveProperty(id)
    })
  })

  it("each non-custom personality has a non-empty systemPrompt", () => {
    const nonCustom: PersonalityType[] = [
      "assistant",
      "creative",
      "technical",
      "friendly",
      "professional",
      "socratic",
      "concise",
    ]

    nonCustom.forEach((id) => {
      const { systemPrompt } = AI_PERSONALITIES[id]
      expect(systemPrompt.trim().length).toBeGreaterThan(0)
    })
  })

  it("'custom' personality has an empty default systemPrompt (user provides their own)", () => {
    expect(AI_PERSONALITIES.custom.systemPrompt).toBe("")
  })

  it("all personalities have a non-empty name, description, icon, and color", () => {
    Object.values(AI_PERSONALITIES).forEach(({ id, name, description, icon, color }) => {
      expect(name.trim().length).toBeGreaterThan(0)
      expect(description.trim().length).toBeGreaterThan(0)
      expect(icon.trim().length).toBeGreaterThan(0)
      expect(color.trim().length).toBeGreaterThan(0)
      // id field must match the key
      expect(EXPECTED_PERSONALITY_IDS).toContain(id)
    })
  })
})

// ---------------------------------------------------------------------------
// 2. All non-custom system prompts are distinct
// ---------------------------------------------------------------------------

describe("AI_PERSONALITIES — system prompt distinctness", () => {
  it("no two non-custom personalities share the same system prompt", () => {
    const prompts = EXPECTED_PERSONALITY_IDS.filter((id) => id !== "custom").map(
      (id) => AI_PERSONALITIES[id].systemPrompt
    )

    const uniquePrompts = new Set(prompts)
    expect(uniquePrompts.size).toBe(prompts.length)
  })
})

// ---------------------------------------------------------------------------
// 3. getSystemPrompt — named personalities
// ---------------------------------------------------------------------------

describe("getSystemPrompt — named personality types", () => {
  it("returns the assistant system prompt for 'assistant'", () => {
    const result = getSystemPrompt("assistant")
    expect(result).toBe(AI_PERSONALITIES.assistant.systemPrompt)
    expect(result.trim().length).toBeGreaterThan(0)
  })

  it("returns the creative system prompt for 'creative'", () => {
    const result = getSystemPrompt("creative")
    expect(result).toBe(AI_PERSONALITIES.creative.systemPrompt)
  })

  it("returns the technical system prompt for 'technical'", () => {
    const result = getSystemPrompt("technical")
    expect(result).toBe(AI_PERSONALITIES.technical.systemPrompt)
  })

  it("returns the friendly system prompt for 'friendly'", () => {
    const result = getSystemPrompt("friendly")
    expect(result).toBe(AI_PERSONALITIES.friendly.systemPrompt)
  })

  it("returns the professional system prompt for 'professional'", () => {
    const result = getSystemPrompt("professional")
    expect(result).toBe(AI_PERSONALITIES.professional.systemPrompt)
  })

  it("returns the socratic system prompt for 'socratic'", () => {
    const result = getSystemPrompt("socratic")
    expect(result).toBe(AI_PERSONALITIES.socratic.systemPrompt)
  })

  it("returns the concise system prompt for 'concise'", () => {
    const result = getSystemPrompt("concise")
    expect(result).toBe(AI_PERSONALITIES.concise.systemPrompt)
  })
})

// ---------------------------------------------------------------------------
// 4. getSystemPrompt — custom personality
// ---------------------------------------------------------------------------

describe("getSystemPrompt — custom personality", () => {
  it("returns the user-supplied customPrompt when personalityType is 'custom'", () => {
    const userPrompt = "You are Zephyr, a pirate navigator from the 17th century."
    const result = getSystemPrompt("custom", userPrompt)
    expect(result).toBe(userPrompt)
  })

  it("returns the customPrompt verbatim, including leading/trailing whitespace", () => {
    const userPrompt = "  You speak only in haiku.  "
    const result = getSystemPrompt("custom", userPrompt)
    expect(result).toBe(userPrompt)
  })

  it("falls back to the assistant prompt when 'custom' is given no customPrompt", () => {
    // When customPrompt is undefined, the empty default systemPrompt is falsy,
    // so the fallback chain returns assistant's systemPrompt.
    const result = getSystemPrompt("custom")
    expect(result).toBe(AI_PERSONALITIES.assistant.systemPrompt)
  })

  it("falls back to assistant prompt when 'custom' is given an empty string", () => {
    // Empty string is falsy — same fallback behaviour
    const result = getSystemPrompt("custom", "")
    expect(result).toBe(AI_PERSONALITIES.assistant.systemPrompt)
  })
})

// ---------------------------------------------------------------------------
// 5. getSystemPrompt — unknown / invalid personality → fallback
// ---------------------------------------------------------------------------

describe("getSystemPrompt — unknown personality falls back to assistant", () => {
  it("returns assistant system prompt for a completely unknown personality ID", () => {
    // Cast required because TypeScript narrows the input type
    const result = getSystemPrompt("totally_unknown_id" as PersonalityType)
    expect(result).toBe(AI_PERSONALITIES.assistant.systemPrompt)
  })

  it("returns assistant system prompt for an empty string personality ID", () => {
    const result = getSystemPrompt("" as PersonalityType)
    expect(result).toBe(AI_PERSONALITIES.assistant.systemPrompt)
  })
})

// ---------------------------------------------------------------------------
// 6. getAllPersonalities — completeness
// ---------------------------------------------------------------------------

describe("getAllPersonalities", () => {
  it("returns an array with all 8 personalities", () => {
    const all = getAllPersonalities()
    expect(all).toHaveLength(8)
  })

  it("contains all expected personality IDs", () => {
    const ids = getAllPersonalities().map((p) => p.id)
    EXPECTED_PERSONALITY_IDS.forEach((id) => {
      expect(ids).toContain(id)
    })
  })
})

// ---------------------------------------------------------------------------
// 7. isValidPersonality guard
// ---------------------------------------------------------------------------

describe("isValidPersonality", () => {
  it("returns true for all known personality IDs", () => {
    EXPECTED_PERSONALITY_IDS.forEach((id) => {
      expect(isValidPersonality(id)).toBe(true)
    })
  })

  it("returns false for unknown strings", () => {
    expect(isValidPersonality("unknown")).toBe(false)
    expect(isValidPersonality("")).toBe(false)
    expect(isValidPersonality("ASSISTANT")).toBe(false) // case-sensitive
  })
})
