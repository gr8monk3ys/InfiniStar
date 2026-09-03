import { STARTER_CHARACTERS } from "@/prisma/starter-characters"

import { getCategoryById } from "@/app/lib/character-categories"

/**
 * The launch catalog is the only content a first visitor sees, and it is the
 * product's argument that its conversations are good. These tests hold it to
 * the depth that argument needs.
 *
 * `scenario` and `exampleDialogues` matter most: `buildCharacterSystemPrompt`
 * turns them into the `[Scenario]` and `[Example Dialogue]` blocks that give
 * the model concrete anchors for a character's voice. A character without them
 * is a system prompt and a greeting — which is what every seeded character was
 * before this, and why the catalog could not demonstrate anything.
 */

const published = STARTER_CHARACTERS.filter((c) => c.isPublic)
const unpublished = STARTER_CHARACTERS.filter((c) => !c.isPublic)

describe("the launch catalog", () => {
  it("publishes a short shelf rather than a long one", () => {
    expect(published.length).toBeGreaterThanOrEqual(5)
    expect(published.length).toBeLessThanOrEqual(8)
  })

  it("keeps every slug unique", () => {
    const slugs = STARTER_CHARACTERS.map((c) => c.slug)
    expect(new Set(slugs).size).toBe(slugs.length)
  })

  it("uses slugs that are URL-safe", () => {
    for (const c of STARTER_CHARACTERS) {
      expect(c.slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/)
    }
  })

  it("spreads the published set across categories rather than stacking one", () => {
    const categories = published.map((c) => c.category)
    expect(new Set(categories).size).toBeGreaterThanOrEqual(5)
  })

  it("only uses categories the app actually renders", () => {
    for (const c of STARTER_CHARACTERS) {
      expect(getCategoryById(c.category)).toBeDefined()
    }
  })

  it("features at least one character but does not feature them all", () => {
    const featured = published.filter((c) => c.featured)
    expect(featured.length).toBeGreaterThanOrEqual(1)
    expect(featured.length).toBeLessThan(published.length)
  })
})

describe("every published character carries real depth", () => {
  it.each(published.map((c) => [c.name, c] as const))("%s", (_name, c) => {
    expect(c.tagline.length).toBeGreaterThanOrEqual(20)
    expect(c.description.length).toBeGreaterThanOrEqual(120)
    expect(c.greeting.length).toBeGreaterThanOrEqual(60)
    expect(c.systemPrompt.length).toBeGreaterThanOrEqual(300)
    expect(c.tags.length).toBeGreaterThanOrEqual(3)
  })

  /**
   * The two fields the roleplay pivot added and nothing has ever used. Without
   * a scenario the model has no opening situation; without examples it has no
   * voice to match, only an instruction to have one.
   */
  it.each(published.map((c) => [c.name, c] as const))(
    "%s opens in a concrete scenario",
    (_name, c) => {
      expect(c.scenario).toBeTruthy()
      expect(c.scenario!.length).toBeGreaterThanOrEqual(80)
    }
  )

  it.each(published.map((c) => [c.name, c] as const))(
    "%s shows its voice in example dialogue",
    (_name, c) => {
      expect(c.exampleDialogues).toBeTruthy()
      const examples = c.exampleDialogues!

      // `buildCharacterSystemPrompt` pastes this verbatim under
      // `[Example Dialogue]`, so it has to read as dialogue on its own.
      //
      // The speaker label is a name the reader recognises as this character,
      // not necessarily the full display name: "Detective Ash Harlow:" on every
      // line would be worse dialogue than "Ash:". Any word of the name counts,
      // and whichever is used has to be used consistently.
      const labels = [c.name, ...c.name.split(" ")].filter((w) => w.length > 2)
      const used = labels.filter((l) => examples.includes(`${l}:`))
      expect(used.length).toBeGreaterThan(0)

      // Both sides, or the model learns a monologue.
      expect(examples).toContain("User:")

      // At least two exchanges, so voice is demonstrated rather than sampled.
      const label = used.sort((a, b) => b.length - a.length)[0]
      const characterTurns = examples.split(`${label}:`).length - 1
      expect(characterTurns).toBeGreaterThanOrEqual(2)
    }
  )

  /**
   * The prompt builder tells the model to use asterisks for actions. Examples
   * that never do teach the opposite of what the rules ask for.
   */
  it.each(published.map((c) => [c.name, c] as const))(
    "%s demonstrates the asterisk action style the roleplay rules require",
    (_name, c) => {
      expect(c.exampleDialogues!).toMatch(/\*[^*]+\*/)
    }
  )
})

describe("what is deliberately not published", () => {
  /**
   * The study, fitness, language and thinking-partner characters are
   * productivity-assistant shaped, which pulls against the character-first
   * positioning in PRODUCT.md. They are kept, not deleted, so they can be
   * published later without rewriting them.
   */
  it("keeps the retired characters rather than deleting them", () => {
    expect(unpublished.length).toBeGreaterThan(0)
  })

  it("still holds them to a publishable standard, minus the depth fields", () => {
    for (const c of unpublished) {
      expect(c.name).toBeTruthy()
      expect(c.tagline).toBeTruthy()
      expect(c.systemPrompt.length).toBeGreaterThanOrEqual(200)
    }
  })
})

describe("no invented social proof", () => {
  /**
   * PRODUCT.md: "No real testimonials, user counts, press, or case studies
   * exist. Never invent them." Seeding engagement counters would be exactly
   * that, and the card already hides zero-value stat pills.
   */
  it("seeds no engagement counters", () => {
    for (const c of STARTER_CHARACTERS) {
      expect(c).not.toHaveProperty("usageCount")
      expect(c).not.toHaveProperty("likeCount")
      expect(c).not.toHaveProperty("commentCount")
      expect(c).not.toHaveProperty("viewCount")
    }
  })
})
