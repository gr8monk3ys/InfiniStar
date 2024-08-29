/**
 * Character Card V2 Import/Export
 *
 * Supports the community-standard V2 character card format used by
 * SillyTavern, Chub.ai, and other roleplay platforms. Handles:
 *
 * - V2 JSON export/import (spec: "chara_card_v2")
 * - V1 JSON fallback (no spec field, flat structure)
 * - PNG tEXt chunk extraction (base64-encoded JSON in "chara" keyword)
 */

// ---------------------------------------------------------------------------
// V2 Card Types
// ---------------------------------------------------------------------------

export interface CharaCardV2 {
  spec: "chara_card_v2"
  spec_version: "2.0"
  data: CharaCardV2Data
}

export interface CharaCardV2Data {
  name: string
  description: string
  personality: string
  scenario: string
  first_mes: string
  mes_example: string
  creator_notes: string
  system_prompt: string
  post_history_instructions: string
  alternate_greetings: string[]
  tags: string[]
  creator: string
  character_version: string
  extensions: Record<string, unknown>
}

/** V1 format — flat structure, no spec field */
interface CharaCardV1 {
  name: string
  description?: string
  personality?: string
  scenario?: string
  first_mes?: string
  mes_example?: string
  metadata?: { tags?: string[]; creator?: string }
}

/** InfiniStar character fields for import/export */
export interface InfiniStarCharacterExport {
  name: string
  tagline: string | null
  description: string | null
  greeting: string | null
  scenario: string | null
  exampleDialogues: string | null
  systemPrompt: string
  avatarUrl: string | null
  coverImageUrl: string | null
  tags: string[]
  category: string
  isNsfw: boolean
}

// ---------------------------------------------------------------------------
// Export: InfiniStar → V2
// ---------------------------------------------------------------------------

export function toCharaCardV2(
  character: InfiniStarCharacterExport,
  creatorName?: string
): CharaCardV2 {
  return {
    spec: "chara_card_v2",
    spec_version: "2.0",
    data: {
      name: character.name,
      description: character.description || "",
      personality: "",
      scenario: character.scenario || "",
      first_mes: character.greeting || "",
      mes_example: character.exampleDialogues || "",
      creator_notes: character.tagline || "",
      system_prompt: character.systemPrompt,
      post_history_instructions: "",
      alternate_greetings: [],
      tags: character.tags,
      creator: creatorName || "",
      character_version: "1.0",
      extensions: {
        infinistar: {
          avatar_url: character.avatarUrl,
          cover_image_url: character.coverImageUrl,
          category: character.category,
          nsfw: character.isNsfw,
        },
      },
    },
  }
}

// ---------------------------------------------------------------------------
// Import: V2/V1 JSON → InfiniStar fields
// ---------------------------------------------------------------------------

export interface ImportResult {
  character: InfiniStarCharacterExport
  warnings: string[]
}

export function fromCharaCard(json: unknown): ImportResult {
  const warnings: string[] = []

  if (!json || typeof json !== "object") {
    throw new CardParseError("Invalid character card: expected a JSON object")
  }

  const obj = json as Record<string, unknown>

  // Detect format
  if (obj.spec === "chara_card_v2" && obj.data && typeof obj.data === "object") {
    return fromV2(obj.data as Record<string, unknown>, warnings)
  }

  // V1 fallback: flat structure with at least a name
  if (typeof obj.name === "string") {
    return fromV1(obj as unknown as CharaCardV1, warnings)
  }

  // Maybe it's just the inner "data" object without the wrapper
  if (typeof obj.name === "string" && typeof obj.system_prompt === "string") {
    return fromV2(obj, warnings)
  }

  throw new CardParseError(
    "Unrecognized character card format. Expected V2 (spec: chara_card_v2) or V1 (name field at root)."
  )
}

function fromV2(data: Record<string, unknown>, warnings: string[]): ImportResult {
  const name = str(data.name)
  if (!name) {
    throw new CardParseError("Character card missing required 'name' field")
  }

  // Build system prompt: prefer explicit system_prompt, fall back to description + personality
  let systemPrompt = str(data.system_prompt)
  if (!systemPrompt) {
    const desc = str(data.description)
    const personality = str(data.personality)
    if (desc || personality) {
      systemPrompt = [desc, personality].filter(Boolean).join("\n\n")
      warnings.push("No system_prompt found — constructed from description and personality fields.")
    }
  }

  if (!systemPrompt || systemPrompt.length < 10) {
    throw new CardParseError(
      "Character card must have a system_prompt (or description) of at least 10 characters."
    )
  }

  // Truncate fields to InfiniStar limits
  const tagline = truncate(str(data.creator_notes), 120)
  const description = truncate(str(data.description), 2000)
  const greeting = truncate(str(data.first_mes), 500)
  const scenario = truncate(str(data.scenario), 2000)
  const exampleDialogues = truncate(str(data.mes_example), 4000)
  systemPrompt = truncate(systemPrompt, 4000)!

  if (str(data.creator_notes) && str(data.creator_notes)!.length > 120) {
    warnings.push("Creator notes truncated to 120 characters (tagline limit).")
  }
  if (str(data.first_mes) && str(data.first_mes)!.length > 500) {
    warnings.push("First message truncated to 500 characters (greeting limit).")
  }

  // Parse tags
  let tags: string[] = []
  if (Array.isArray(data.tags)) {
    tags = (data.tags as unknown[])
      .filter((t): t is string => typeof t === "string" && t.length > 0)
      .slice(0, 10)
      .map((t) => t.slice(0, 30))
  }

  // Check for InfiniStar-specific extensions
  let avatarUrl: string | null = null
  let coverImageUrl: string | null = null
  let category = "general"
  let isNsfw = false

  const extensions = data.extensions as Record<string, unknown> | undefined
  if (extensions && typeof extensions === "object") {
    const infinistar = extensions.infinistar as Record<string, unknown> | undefined
    if (infinistar && typeof infinistar === "object") {
      if (typeof infinistar.avatar_url === "string") avatarUrl = infinistar.avatar_url
      if (typeof infinistar.cover_image_url === "string") coverImageUrl = infinistar.cover_image_url
      if (typeof infinistar.category === "string") category = infinistar.category
      if (typeof infinistar.nsfw === "boolean") isNsfw = infinistar.nsfw
    }
  }

  // Note alternate greetings if present
  if (
    Array.isArray(data.alternate_greetings) &&
    (data.alternate_greetings as unknown[]).length > 0
  ) {
    warnings.push(
      `${(data.alternate_greetings as unknown[]).length} alternate greetings found but not imported (not yet supported).`
    )
  }

  return {
    character: {
      name: name.slice(0, 60),
      tagline,
      description,
      greeting,
      scenario,
      exampleDialogues,
      systemPrompt,
      avatarUrl,
      coverImageUrl,
      tags,
      category,
      isNsfw,
    },
    warnings,
  }
}

function fromV1(card: CharaCardV1, warnings: string[]): ImportResult {
  warnings.push("Detected V1 character card format — some fields may not be available.")

  const name = card.name
  if (!name) {
    throw new CardParseError("Character card missing required 'name' field")
  }

  let systemPrompt = card.description || card.personality || ""
  if (card.description && card.personality) {
    systemPrompt = `${card.description}\n\n${card.personality}`
  }

  if (systemPrompt.length < 10) {
    throw new CardParseError(
      "V1 card must have a description or personality of at least 10 characters."
    )
  }

  return {
    character: {
      name: name.slice(0, 60),
      tagline: null,
      description: truncate(card.description, 2000),
      greeting: truncate(card.first_mes, 500),
      scenario: truncate(card.scenario, 2000),
      exampleDialogues: truncate(card.mes_example, 4000),
      systemPrompt: truncate(systemPrompt, 4000)!,
      avatarUrl: null,
      coverImageUrl: null,
      tags: card.metadata?.tags?.slice(0, 10).map((t) => t.slice(0, 30)) || [],
      category: "general",
      isNsfw: false,
    },
    warnings,
  }
}

// ---------------------------------------------------------------------------
// PNG tEXt chunk extraction
// ---------------------------------------------------------------------------

const PNG_SIGNATURE = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])

export function extractJsonFromPng(buffer: ArrayBuffer): unknown {
  const bytes = new Uint8Array(buffer)

  // Verify PNG signature
  for (let i = 0; i < PNG_SIGNATURE.length; i++) {
    if (bytes[i] !== PNG_SIGNATURE[i]) {
      throw new CardParseError("Not a valid PNG file")
    }
  }

  let offset = 8 // Skip signature

  while (offset < bytes.length) {
    if (offset + 8 > bytes.length) break

    // Read chunk length (big-endian uint32)
    const length =
      (bytes[offset] << 24) |
      (bytes[offset + 1] << 16) |
      (bytes[offset + 2] << 8) |
      bytes[offset + 3]

    // Read chunk type
    const type = String.fromCharCode(
      bytes[offset + 4],
      bytes[offset + 5],
      bytes[offset + 6],
      bytes[offset + 7]
    )

    const dataStart = offset + 8

    if (type === "tEXt" && dataStart + length <= bytes.length) {
      // tEXt: keyword\0text
      const chunkData = bytes.slice(dataStart, dataStart + length)
      const nullIndex = chunkData.indexOf(0)

      if (nullIndex !== -1) {
        const keyword = new TextDecoder().decode(chunkData.slice(0, nullIndex))

        if (keyword === "chara") {
          const base64Text = new TextDecoder().decode(chunkData.slice(nullIndex + 1))
          const jsonString = atob(base64Text)
          return JSON.parse(jsonString)
        }
      }
    }

    // Move to next chunk: length + type (4) + data (length) + CRC (4)
    offset = dataStart + length + 4
  }

  throw new CardParseError(
    'No character data found in PNG. Expected a tEXt chunk with keyword "chara".'
  )
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function str(value: unknown): string | null {
  if (typeof value === "string" && value.trim().length > 0) {
    return value.trim()
  }
  return null
}

function truncate(value: string | null | undefined, max: number): string | null {
  if (!value) return null
  return value.length > max ? value.slice(0, max) : value
}

export class CardParseError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "CardParseError"
  }
}
