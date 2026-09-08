/**
 * A deterministic portrait for a character with no artwork.
 *
 * Most characters will not have an image: the creator form makes uploading
 * optional, and the launch catalog ships without art. The first fallback gave
 * every one of them the same brand gradient with a different letter on it,
 * which reads as a missing image rather than a chosen one — a wall of identical
 * tiles. Deriving the stops from the slug fixed the wall, but two stops on a
 * diagonal is still a swatch, and a swatch with a letter on it still reads as a
 * placeholder waiting for the real thing.
 *
 * This composes an aurora field instead: a base wash with three soft lights
 * placed at slug-derived positions. Nothing about it is random at runtime — the
 * same character always looks the same — but no two characters share a
 * composition, and the result reads as a treatment somebody chose.
 *
 * The stops come from the aurora tokens only. DESIGN.md permits fuchsia, pink
 * and amber inside gradients and nowhere else, so every colour here is a
 * variable: theme changes and token edits carry without touching this file.
 */

/** Aurora pairs for the base wash. */
const PAIRS = [
  ["--aurora-violet", "--aurora-fuchsia"],
  ["--aurora-fuchsia", "--gradient-end"],
  ["--aurora-violet", "--gradient-end"],
  ["--aurora-fuchsia", "--aurora-amber"],
  ["--aurora-violet", "--aurora-amber"],
] as const

const ANGLES = [135, 160, 200, 115, 175] as const

/** The light that sits over the wash, and how strongly. */
const LIGHTS = ["--aurora-amber", "--aurora-fuchsia", "--aurora-violet", "--gradient-end"] as const

/**
 * Where the three lights sit, as percentages. Three fixed arrangements rather
 * than free positioning: a light too close to the bottom edge fights the
 * caption scrim, and one dead-centre sits behind the initial.
 */
const ARRANGEMENTS = [
  [
    [18, 14],
    [82, 30],
    [55, 78],
  ],
  [
    [78, 16],
    [22, 38],
    [60, 82],
  ],
  [
    [50, 10],
    [12, 52],
    [88, 70],
  ],
] as const

/** FNV-1a. Small, stable across runtimes, and good enough to spread short slugs. */
function hash(input: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

export interface CharacterPortrait {
  /**
   * Inline background, because the stops vary per character and Tailwind needs
   * static classes. Layered: lights first, wash last, which is CSS background
   * order — the first layer paints on top.
   */
  backgroundImage: string
  /** The letter shown over it. */
  initial: string
}

export function characterPortrait(character: { slug: string; name: string }): CharacterPortrait {
  const h = hash(character.slug)
  const [from, to] = PAIRS[h % PAIRS.length]
  const angle = ANGLES[(h >>> 8) % ANGLES.length]
  const arrangement = ARRANGEMENTS[(h >>> 16) % ARRANGEMENTS.length]

  const lights = arrangement.map(([x, y], index) => {
    const colour = LIGHTS[(h >>> (4 * index)) % LIGHTS.length]
    // Sized apart so the three read as depth rather than three equal blobs.
    const radius = [70, 55, 62][index]
    const alpha = [0.55, 0.42, 0.38][index]
    return `radial-gradient(${radius}% ${radius}% at ${x}% ${y}%, hsl(var(${colour}) / ${alpha}), transparent 70%)`
  })

  return {
    backgroundImage: [
      ...lights,
      `linear-gradient(${angle}deg, hsl(var(${from})), hsl(var(${to})))`,
    ].join(", "),
    initial: (character.name.trim()[0] ?? "?").toUpperCase(),
  }
}
