/**
 * @jest-environment node
 *
 * Eval: Character System Prompt Assembly
 *
 * Locks in the structural and content guarantees of buildCharacterSystemPrompt
 * so that prompt-quality regressions are caught in CI before they reach
 * the model.  No live API calls — this is pure string-assembly logic.
 */
import { buildCharacterSystemPrompt } from "@/app/lib/character-prompt"

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const FULL_CHARACTER = {
  name: "Aria",
  systemPrompt:
    "You are Aria, a witty elven scholar who speaks in precise, slightly archaic English.",
  scenario:
    "The year is 1347. Aria runs a hidden library beneath a cathedral and has just discovered a forbidden manuscript.",
  exampleDialogues:
    'User: What is that book?\nAria: *traces the spine carefully* "This tome should not exist. Yet here it stands."',
}

const MINIMAL_CHARACTER = {
  name: "Echo",
  systemPrompt: "You are Echo, a quiet forest spirit.",
  scenario: null,
  exampleDialogues: null,
}

const UNNAMED_CHARACTER = {
  name: null,
  systemPrompt: "You are a mysterious wanderer.",
  scenario: null,
  exampleDialogues: null,
}

// ---------------------------------------------------------------------------
// 1. Full character fixture — all sections present
// ---------------------------------------------------------------------------

describe("buildCharacterSystemPrompt — full character", () => {
  let prompt: string

  beforeAll(() => {
    prompt = buildCharacterSystemPrompt(FULL_CHARACTER)
  })

  it("includes the character's own systemPrompt verbatim", () => {
    expect(prompt).toContain(FULL_CHARACTER.systemPrompt)
  })

  it("includes the scenario under a [Scenario] heading", () => {
    expect(prompt).toContain("[Scenario]")
    expect(prompt).toContain(FULL_CHARACTER.scenario!)
  })

  it("includes an [Example Dialogue] section with the framing instruction", () => {
    expect(prompt).toContain("[Example Dialogue]")
    expect(prompt).toContain("Match their voice, tone, and style")
    expect(prompt).toContain("do not copy the examples verbatim")
  })

  it("includes the example dialogue content itself", () => {
    expect(prompt).toContain(FULL_CHARACTER.exampleDialogues!)
  })

  it("closes the examples section with the end-of-examples marker", () => {
    expect(prompt).toContain("(End of examples. Respond only to the actual conversation below.)")
  })

  // ---- Roleplay guardrails ----

  it("includes a [Roleplay Rules] block", () => {
    expect(prompt).toContain("[Roleplay Rules]")
  })

  it("stay-in-character rule references the character by name", () => {
    expect(prompt).toContain("Stay fully in character as Aria")
  })

  it("stay-in-character rule forbids breaking the fourth wall", () => {
    expect(prompt).toContain("Do not mention being an AI or break the fourth wall")
  })

  it("never-write-for-user guardrail is present", () => {
    expect(prompt).toContain("Never write actions, dialogue, or decisions for the user")
    expect(prompt).toContain("Only portray your own character")
  })

  it("asterisk action formatting rule is present", () => {
    expect(prompt).toContain("*asterisks* for actions and expressions")
    expect(prompt).toContain("*glances at the door*")
  })

  it("pacing-match rule is present", () => {
    expect(prompt).toContain("Match the user's pacing")
    expect(prompt).toContain("short messages get short replies")
  })

  it("OOC-handling rule is present", () => {
    expect(prompt).toContain("out of character")
    expect(prompt).toContain("return to the scene")
  })
})

// ---------------------------------------------------------------------------
// 2. Minimal character — only systemPrompt, no scenario or examples
// ---------------------------------------------------------------------------

describe("buildCharacterSystemPrompt — minimal character (no scenario/examples)", () => {
  let prompt: string

  beforeAll(() => {
    prompt = buildCharacterSystemPrompt(MINIMAL_CHARACTER)
  })

  it("includes the character's systemPrompt", () => {
    expect(prompt).toContain(MINIMAL_CHARACTER.systemPrompt)
  })

  it("still emits the [Roleplay Rules] block", () => {
    expect(prompt).toContain("[Roleplay Rules]")
  })

  it("names the character in the stay-in-character rule", () => {
    expect(prompt).toContain("Stay fully in character as Echo")
  })

  it("does NOT emit an empty [Scenario] section", () => {
    expect(prompt).not.toContain("[Scenario]")
  })

  it("does NOT emit an empty [Example Dialogue] section", () => {
    expect(prompt).not.toContain("[Example Dialogue]")
  })

  it("all five guardrail substrings are still present", () => {
    expect(prompt).toContain("Stay fully in character")
    expect(prompt).toContain("Never write actions, dialogue, or decisions for the user")
    expect(prompt).toContain("*asterisks* for actions and expressions")
    expect(prompt).toContain("Match the user's pacing")
    expect(prompt).toContain("out of character")
  })
})

// ---------------------------------------------------------------------------
// 3. Unnamed character — name is null / trimmed to empty
// ---------------------------------------------------------------------------

describe("buildCharacterSystemPrompt — unnamed character", () => {
  let prompt: string

  beforeAll(() => {
    prompt = buildCharacterSystemPrompt(UNNAMED_CHARACTER)
  })

  it("includes systemPrompt", () => {
    expect(prompt).toContain(UNNAMED_CHARACTER.systemPrompt)
  })

  it("uses generic stay-in-character phrasing when no name is provided", () => {
    expect(prompt).toContain("Stay fully in character.")
    // Should NOT contain "as " followed by a name
    expect(prompt).not.toMatch(/Stay fully in character as \w/)
  })

  it("still contains all required guardrail rules", () => {
    expect(prompt).toContain("[Roleplay Rules]")
    expect(prompt).toContain("Never write actions, dialogue, or decisions for the user")
    expect(prompt).toContain("*asterisks* for actions and expressions")
  })
})

// ---------------------------------------------------------------------------
// 4. Output is a single joined string (no undefined segments)
// ---------------------------------------------------------------------------

describe("buildCharacterSystemPrompt — return value", () => {
  it("returns a non-empty string for a full character", () => {
    const result = buildCharacterSystemPrompt(FULL_CHARACTER)
    expect(typeof result).toBe("string")
    expect(result.length).toBeGreaterThan(0)
  })

  it("returns a non-empty string for a minimal character", () => {
    const result = buildCharacterSystemPrompt(MINIMAL_CHARACTER)
    expect(typeof result).toBe("string")
    expect(result.length).toBeGreaterThan(0)
  })

  it("does not contain the string 'undefined' or 'null'", () => {
    const result = buildCharacterSystemPrompt(FULL_CHARACTER)
    expect(result).not.toContain("undefined")
    expect(result).not.toContain("null")
  })
})
