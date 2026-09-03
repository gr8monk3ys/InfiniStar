import { STARTER_CHARACTERS } from "@/prisma/starter-characters"

import { characterPortrait } from "@/app/lib/character-portrait"

/**
 * Most characters have no artwork — uploading is optional in the creator form,
 * and the launch catalog ships without any. The old fallback gave every one of
 * them the same brand gradient, so an Explore grid was a wall of identical
 * tiles that read as broken images rather than as a design.
 */
describe("characterPortrait", () => {
  it("is stable for a given character", () => {
    const a = characterPortrait({ slug: "elara-the-storyteller", name: "Elara" })
    const b = characterPortrait({ slug: "elara-the-storyteller", name: "Elara" })
    expect(a).toEqual(b)
  })

  it("keys off the slug, not the display name", () => {
    const a = characterPortrait({ slug: "same-slug", name: "One Name" })
    const b = characterPortrait({ slug: "same-slug", name: "Totally Different" })
    expect(a.backgroundImage).toBe(b.backgroundImage)
  })

  it("draws only from the aurora tokens, never a hardcoded colour", () => {
    for (const c of STARTER_CHARACTERS) {
      const { backgroundImage } = characterPortrait(c)
      expect(backgroundImage).toMatch(
        /^linear-gradient\(\d+deg, hsl\(var\(--[\w-]+\)\), hsl\(var\(--[\w-]+\)\)\)$/
      )
      expect(backgroundImage).not.toMatch(/#[0-9a-f]{3,8}|rgb\(/i)
    }
  })

  it("gives the launch catalog visible variety rather than one repeated tile", () => {
    const distinct = new Set(STARTER_CHARACTERS.map((c) => characterPortrait(c).backgroundImage))
    expect(distinct.size).toBeGreaterThanOrEqual(4)
  })

  it("uses the character's first letter", () => {
    expect(characterPortrait({ slug: "x", name: "yuki hoshino" }).initial).toBe("Y")
    expect(characterPortrait({ slug: "x", name: "  Luna" }).initial).toBe("L")
  })

  it("survives a nameless character rather than throwing", () => {
    expect(characterPortrait({ slug: "x", name: "" }).initial).toBe("?")
  })
})
