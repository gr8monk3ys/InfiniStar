/**
 * A deterministic portrait for a character with no artwork.
 *
 * Most characters will not have an image: the creator form makes uploading
 * optional, and the launch catalog ships without art. The previous fallback
 * gave every one of them the same brand gradient with a different letter on
 * it, which reads as a missing image rather than a chosen one — a wall of
 * identical tiles.
 *
 * This derives a stable treatment from the character's slug instead, so each
 * card has its own colour signature and the same character always looks the
 * same. The stops come from the aurora tokens only: DESIGN.md permits fuchsia,
 * pink and amber inside gradients, and nowhere else.
 */

/** Aurora pairs, expressed as CSS variables so themes and token edits carry. */
const PAIRS = [
  ["--aurora-violet", "--aurora-fuchsia"],
  ["--aurora-fuchsia", "--gradient-end"],
  ["--aurora-violet", "--gradient-end"],
  ["--aurora-fuchsia", "--aurora-amber"],
  ["--aurora-violet", "--aurora-amber"],
] as const

const ANGLES = [135, 160, 200, 115, 175] as const

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
  /** Inline background, because the stops vary per character and Tailwind needs static classes. */
  backgroundImage: string
  /** The letter shown over it. */
  initial: string
}

export function characterPortrait(character: { slug: string; name: string }): CharacterPortrait {
  const h = hash(character.slug)
  const [from, to] = PAIRS[h % PAIRS.length]
  const angle = ANGLES[(h >>> 8) % ANGLES.length]

  return {
    backgroundImage: `linear-gradient(${angle}deg, hsl(var(${from})), hsl(var(${to})))`,
    initial: (character.name.trim()[0] ?? "?").toUpperCase(),
  }
}
