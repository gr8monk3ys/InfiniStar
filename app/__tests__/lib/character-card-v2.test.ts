import {
  CardParseError,
  extractJsonFromPng,
  fromCharaCard,
  toCharaCardV2,
  type InfiniStarCharacterExport,
} from "@/app/lib/character-card-v2"

// ---------------------------------------------------------------------------
// toCharaCardV2 — Export
// ---------------------------------------------------------------------------

describe("toCharaCardV2", () => {
  const baseCharacter: InfiniStarCharacterExport = {
    name: "Test Character",
    tagline: "A test tagline",
    description: "A test description",
    greeting: "Hello there!",
    scenario: "You are in a test environment.",
    exampleDialogues: "{{user}}: Hi\n{{char}}: Hello!",
    systemPrompt: "You are a test character. Respond thoughtfully.",
    avatarUrl: "https://example.com/avatar.png",
    coverImageUrl: "https://example.com/cover.png",
    tags: ["test", "demo"],
    category: "general",
    isNsfw: false,
  }

  it("produces a valid V2 card with spec fields", () => {
    const card = toCharaCardV2(baseCharacter, "TestCreator")

    expect(card.spec).toBe("chara_card_v2")
    expect(card.spec_version).toBe("2.0")
    expect(card.data.name).toBe("Test Character")
    expect(card.data.system_prompt).toBe(baseCharacter.systemPrompt)
    expect(card.data.first_mes).toBe("Hello there!")
    expect(card.data.scenario).toBe("You are in a test environment.")
    expect(card.data.mes_example).toBe("{{user}}: Hi\n{{char}}: Hello!")
    expect(card.data.creator_notes).toBe("A test tagline")
    expect(card.data.description).toBe("A test description")
    expect(card.data.tags).toEqual(["test", "demo"])
    expect(card.data.creator).toBe("TestCreator")
  })

  it("stores InfiniStar extensions", () => {
    const card = toCharaCardV2(baseCharacter)
    const ext = card.data.extensions.infinistar as Record<string, unknown>

    expect(ext.avatar_url).toBe("https://example.com/avatar.png")
    expect(ext.cover_image_url).toBe("https://example.com/cover.png")
    expect(ext.category).toBe("general")
    expect(ext.nsfw).toBe(false)
  })

  it("handles null optional fields gracefully", () => {
    const minimal: InfiniStarCharacterExport = {
      name: "Minimal",
      tagline: null,
      description: null,
      greeting: null,
      scenario: null,
      exampleDialogues: null,
      systemPrompt: "A minimal system prompt for testing.",
      avatarUrl: null,
      coverImageUrl: null,
      tags: [],
      category: "general",
      isNsfw: false,
    }

    const card = toCharaCardV2(minimal)

    expect(card.data.name).toBe("Minimal")
    expect(card.data.first_mes).toBe("")
    expect(card.data.scenario).toBe("")
    expect(card.data.creator_notes).toBe("")
    expect(card.data.creator).toBe("")
  })
})

// ---------------------------------------------------------------------------
// fromCharaCard — Import
// ---------------------------------------------------------------------------

describe("fromCharaCard", () => {
  it("parses a valid V2 card", () => {
    const card = {
      spec: "chara_card_v2",
      spec_version: "2.0",
      data: {
        name: "Luna",
        description: "A moon goddess",
        personality: "",
        scenario: "A moonlit temple",
        first_mes: "The moonlight illuminates the path before you.",
        mes_example: "{{user}}: Who are you?\n{{char}}: I am Luna.",
        creator_notes: "My first character",
        system_prompt: "You are Luna, the moon goddess. Speak with ethereal grace.",
        post_history_instructions: "",
        alternate_greetings: [],
        tags: ["fantasy", "goddess"],
        creator: "TestUser",
        character_version: "1.0",
        extensions: {},
      },
    }

    const { character, warnings } = fromCharaCard(card)

    expect(character.name).toBe("Luna")
    expect(character.systemPrompt).toBe(
      "You are Luna, the moon goddess. Speak with ethereal grace."
    )
    expect(character.greeting).toBe("The moonlight illuminates the path before you.")
    expect(character.scenario).toBe("A moonlit temple")
    expect(character.exampleDialogues).toBe("{{user}}: Who are you?\n{{char}}: I am Luna.")
    expect(character.tagline).toBe("My first character")
    expect(character.tags).toEqual(["fantasy", "goddess"])
    expect(warnings).toEqual([])
  })

  it("falls back to description+personality when system_prompt is empty", () => {
    const card = {
      spec: "chara_card_v2",
      spec_version: "2.0",
      data: {
        name: "Fallback",
        description: "A brave warrior who fights for justice and protects the innocent.",
        personality: "Courageous, kind, loyal",
        system_prompt: "",
        scenario: "",
        first_mes: "",
        mes_example: "",
        creator_notes: "",
        post_history_instructions: "",
        alternate_greetings: [],
        tags: [],
        creator: "",
        character_version: "",
        extensions: {},
      },
    }

    const { character, warnings } = fromCharaCard(card)

    expect(character.systemPrompt).toContain("A brave warrior")
    expect(character.systemPrompt).toContain("Courageous, kind, loyal")
    expect(warnings).toContain(
      "No system_prompt found — constructed from description and personality fields."
    )
  })

  it("parses V1 format cards", () => {
    const v1 = {
      name: "V1 Character",
      description: "A character from the V1 era with enough text to meet the minimum.",
      personality: "Wise and old",
      scenario: "An ancient library",
      first_mes: "Welcome to my library.",
      mes_example: "{{user}}: Tell me something.\n{{char}}: Knowledge is power.",
    }

    const { character, warnings } = fromCharaCard(v1)

    expect(character.name).toBe("V1 Character")
    expect(character.greeting).toBe("Welcome to my library.")
    expect(warnings.some((w) => w.includes("V1"))).toBe(true)
  })

  it("truncates fields to InfiniStar limits", () => {
    const longGreeting = "A".repeat(600)
    const card = {
      spec: "chara_card_v2",
      spec_version: "2.0",
      data: {
        name: "Truncator",
        description: "",
        personality: "",
        scenario: "",
        first_mes: longGreeting,
        mes_example: "",
        creator_notes: "",
        system_prompt: "A valid system prompt that meets the minimum length requirement.",
        post_history_instructions: "",
        alternate_greetings: [],
        tags: [],
        creator: "",
        character_version: "",
        extensions: {},
      },
    }

    const { character, warnings } = fromCharaCard(card)

    expect(character.greeting!.length).toBe(500)
    expect(warnings.some((w) => w.includes("truncated"))).toBe(true)
  })

  it("reads InfiniStar extensions", () => {
    const card = {
      spec: "chara_card_v2",
      spec_version: "2.0",
      data: {
        name: "ExtTest",
        description: "",
        personality: "",
        scenario: "",
        first_mes: "",
        mes_example: "",
        creator_notes: "",
        system_prompt: "Extensions test character with enough length to pass.",
        post_history_instructions: "",
        alternate_greetings: [],
        tags: [],
        creator: "",
        character_version: "",
        extensions: {
          infinistar: {
            avatar_url: "https://example.com/a.png",
            cover_image_url: "https://example.com/c.png",
            category: "fantasy",
            nsfw: true,
          },
        },
      },
    }

    const { character } = fromCharaCard(card)

    expect(character.avatarUrl).toBe("https://example.com/a.png")
    expect(character.coverImageUrl).toBe("https://example.com/c.png")
    expect(character.category).toBe("fantasy")
    expect(character.isNsfw).toBe(true)
  })

  it("warns about alternate greetings", () => {
    const card = {
      spec: "chara_card_v2",
      spec_version: "2.0",
      data: {
        name: "AltGreeter",
        description: "",
        personality: "",
        scenario: "",
        first_mes: "Hi",
        mes_example: "",
        creator_notes: "",
        system_prompt: "A character with alternate greetings for testing purposes.",
        post_history_instructions: "",
        alternate_greetings: ["Alt 1", "Alt 2"],
        tags: [],
        creator: "",
        character_version: "",
        extensions: {},
      },
    }

    const { warnings } = fromCharaCard(card)

    expect(warnings.some((w) => w.includes("alternate greetings"))).toBe(true)
  })

  it("throws on missing name", () => {
    const card = {
      spec: "chara_card_v2",
      spec_version: "2.0",
      data: { name: "", system_prompt: "test prompt" },
    }

    expect(() => fromCharaCard(card)).toThrow(CardParseError)
  })

  it("throws on missing system_prompt and description", () => {
    const card = {
      spec: "chara_card_v2",
      spec_version: "2.0",
      data: { name: "NoPrompt" },
    }

    expect(() => fromCharaCard(card)).toThrow(CardParseError)
  })

  it("throws on non-object input", () => {
    expect(() => fromCharaCard("not an object")).toThrow(CardParseError)
    expect(() => fromCharaCard(null)).toThrow(CardParseError)
    expect(() => fromCharaCard(42)).toThrow(CardParseError)
  })

  it("throws on unrecognized format", () => {
    expect(() => fromCharaCard({ random: "data" })).toThrow(CardParseError)
  })
})

// ---------------------------------------------------------------------------
// extractJsonFromPng
// ---------------------------------------------------------------------------

describe("extractJsonFromPng", () => {
  it("throws on non-PNG data", () => {
    const buffer = new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7]).buffer

    expect(() => extractJsonFromPng(buffer as ArrayBuffer)).toThrow(CardParseError)
    expect(() => extractJsonFromPng(buffer as ArrayBuffer)).toThrow("Not a valid PNG")
  })

  it("extracts character data from a PNG with tEXt chara chunk", () => {
    // Build a minimal PNG with a tEXt chunk containing character data
    const charaJson = JSON.stringify({
      spec: "chara_card_v2",
      spec_version: "2.0",
      data: {
        name: "PngChar",
        system_prompt: "Extracted from PNG tEXt chunk successfully.",
        description: "",
        personality: "",
        scenario: "",
        first_mes: "",
        mes_example: "",
        creator_notes: "",
        post_history_instructions: "",
        alternate_greetings: [],
        tags: [],
        creator: "",
        character_version: "",
        extensions: {},
      },
    })

    const base64 = btoa(charaJson)
    const png = buildMinimalPngWithText("chara", base64)

    const result = extractJsonFromPng(png.buffer as ArrayBuffer) as { data: { name: string } }

    expect(result.data.name).toBe("PngChar")
  })

  it("throws when no chara tEXt chunk is found", () => {
    const png = buildMinimalPngWithText("other", "data")

    expect(() => extractJsonFromPng(png.buffer as ArrayBuffer)).toThrow("No character data found")
  })
})

// ---------------------------------------------------------------------------
// Round-trip test
// ---------------------------------------------------------------------------

describe("round-trip export→import", () => {
  it("preserves all fields through export and re-import", () => {
    const original: InfiniStarCharacterExport = {
      name: "RoundTrip",
      tagline: "Test round trip",
      description: "A character for testing round trips",
      greeting: "Hello round trip!",
      scenario: "Testing scenario",
      exampleDialogues: "{{user}}: Test\n{{char}}: Response",
      systemPrompt: "You are RoundTrip. A character for testing export and import.",
      avatarUrl: "https://example.com/avatar.png",
      coverImageUrl: "https://example.com/cover.png",
      tags: ["test"],
      category: "scifi",
      isNsfw: false,
    }

    const exported = toCharaCardV2(original, "RoundTripCreator")
    const { character } = fromCharaCard(exported)

    expect(character.name).toBe(original.name)
    expect(character.tagline).toBe(original.tagline)
    expect(character.description).toBe(original.description)
    expect(character.greeting).toBe(original.greeting)
    expect(character.scenario).toBe(original.scenario)
    expect(character.exampleDialogues).toBe(original.exampleDialogues)
    expect(character.systemPrompt).toBe(original.systemPrompt)
    expect(character.avatarUrl).toBe(original.avatarUrl)
    expect(character.coverImageUrl).toBe(original.coverImageUrl)
    expect(character.tags).toEqual(original.tags)
    expect(character.category).toBe(original.category)
    expect(character.isNsfw).toBe(original.isNsfw)
  })
})

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a minimal valid PNG with a single tEXt chunk */
function buildMinimalPngWithText(keyword: string, text: string): Uint8Array {
  const signature = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])

  // IHDR chunk (minimal 13-byte header)
  const ihdrData = new Uint8Array(13)
  ihdrData[3] = 1 // width = 1
  ihdrData[7] = 1 // height = 1
  ihdrData[8] = 8 // bit depth
  ihdrData[9] = 2 // color type RGB
  const ihdrChunk = buildChunk("IHDR", ihdrData)

  // tEXt chunk: keyword\0text
  const keywordBytes = new TextEncoder().encode(keyword)
  const textBytes = new TextEncoder().encode(text)
  const textData = new Uint8Array(keywordBytes.length + 1 + textBytes.length)
  textData.set(keywordBytes, 0)
  textData[keywordBytes.length] = 0 // null separator
  textData.set(textBytes, keywordBytes.length + 1)
  const textChunk = buildChunk("tEXt", textData)

  // IEND chunk
  const iendChunk = buildChunk("IEND", new Uint8Array(0))

  // Combine
  const result = new Uint8Array(
    signature.length + ihdrChunk.length + textChunk.length + iendChunk.length
  )
  let offset = 0
  result.set(signature, offset)
  offset += signature.length
  result.set(ihdrChunk, offset)
  offset += ihdrChunk.length
  result.set(textChunk, offset)
  offset += textChunk.length
  result.set(iendChunk, offset)

  return result
}

function buildChunk(type: string, data: Uint8Array): Uint8Array {
  const chunk = new Uint8Array(4 + 4 + data.length + 4) // length + type + data + CRC

  // Length (big-endian)
  const len = data.length
  chunk[0] = (len >> 24) & 0xff
  chunk[1] = (len >> 16) & 0xff
  chunk[2] = (len >> 8) & 0xff
  chunk[3] = len & 0xff

  // Type
  const typeBytes = new TextEncoder().encode(type)
  chunk.set(typeBytes, 4)

  // Data
  chunk.set(data, 8)

  // CRC placeholder (not validated by our parser)
  chunk[8 + data.length] = 0
  chunk[9 + data.length] = 0
  chunk[10 + data.length] = 0
  chunk[11 + data.length] = 0

  return chunk
}
