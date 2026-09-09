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

  /**
   * Asserts the invariant, not the composition: every colour is a token, so a
   * theme change or a token edit carries without touching this module. The
   * shape of the gradient stack is free to change; a literal colour is not.
   */
  it("draws only from the aurora tokens, never a hardcoded colour", () => {
    for (const c of STARTER_CHARACTERS) {
      const { backgroundImage } = characterPortrait(c)

      const colours = [...backgroundImage.matchAll(/hsl\(([^)]*\)?[^)]*)\)/g)]
      expect(colours.length).toBeGreaterThan(0)
      for (const [, colour] of colours) {
        expect(colour).toMatch(/^var\(--[\w-]+\)/)
      }
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

describe("the aurora field", () => {
  /**
   * Two stops on a diagonal is a swatch, and a swatch with a letter on it still
   * reads as a placeholder. Each portrait composes a wash plus three lights, so
   * the card reads as a treatment somebody chose.
   */
  it("layers three lights over the wash", () => {
    const { backgroundImage } = characterPortrait({ slug: "elara-the-storyteller", name: "Elara" })

    expect(backgroundImage.match(/radial-gradient/g)).toHaveLength(3)
    expect(backgroundImage).toContain("linear-gradient")
  })

  it("paints the wash last, so the lights sit over it", () => {
    const { backgroundImage } = characterPortrait({ slug: "captain-vega", name: "Vega" })

    expect(backgroundImage.indexOf("radial-gradient")).toBeLessThan(
      backgroundImage.indexOf("linear-gradient")
    )
  })

  /**
   * A light dead-centre sits behind the initial and one at the bottom edge
   * fights the caption scrim, so the arrangements avoid both.
   */
  it("keeps every light clear of the centre and the bottom edge", () => {
    for (const character of STARTER_CHARACTERS) {
      const { backgroundImage } = characterPortrait(character)
      const positions = [...backgroundImage.matchAll(/at (\d+)% (\d+)%/g)]

      expect(positions).toHaveLength(3)
      for (const [, x, y] of positions) {
        expect(Number(y)).toBeLessThanOrEqual(85)
        const isDeadCentre = Math.abs(Number(x) - 50) < 12 && Math.abs(Number(y) - 50) < 12
        expect(isDeadCentre).toBe(false)
      }
    }
  })

  it("gives no two catalog characters the same composition", () => {
    const compositions = new Set(
      STARTER_CHARACTERS.map((c) => characterPortrait(c).backgroundImage)
    )

    expect(compositions.size).toBe(STARTER_CHARACTERS.length)
  })
})
