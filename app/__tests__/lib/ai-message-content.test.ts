import { buildAiConversationHistory, buildAiMessageContent } from "@/app/lib/ai-message-content"

describe("ai-message-content", () => {
  it("builds text-only content as a string", () => {
    const result = buildAiMessageContent("  Hello <b>world</b>  ", null)

    expect(result.sanitizedText).toBe("Hello world")
    expect(result.sanitizedImage).toBeNull()
    expect(result.content).toBe("Hello world")
  })

  it("builds image-only content as an image block", () => {
    const result = buildAiMessageContent("", "https://cdn.example.com/image.png")

    expect(result.sanitizedText).toBe("")
    expect(result.sanitizedImage).toBe("https://cdn.example.com/image.png")
    expect(Array.isArray(result.content)).toBe(true)
    expect(result.content).toEqual([
      {
        type: "image",
        source: {
          type: "url",
          url: "https://cdn.example.com/image.png",
        },
      },
    ])
  })

  it("drops unsafe image URLs", () => {
    const result = buildAiMessageContent("hello", "javascript:alert(1)")

    expect(result.sanitizedImage).toBeNull()
    expect(result.content).toBe("hello")
  })

  it("includes text and image blocks together when both are present", () => {
    const result = buildAiMessageContent("look at this", "https://cdn.example.com/image.webp")

    expect(result.content).toEqual([
      {
        type: "text",
        text: "look at this",
      },
      {
        type: "image",
        source: {
          type: "url",
          url: "https://cdn.example.com/image.webp",
        },
      },
    ])
  })

  it("skips empty messages in conversation history", () => {
    const history = buildAiConversationHistory([
      { isAI: false, body: null, image: null },
      { isAI: false, body: "User text", image: null },
      { isAI: true, body: "AI reply", image: null },
    ])

    expect(history).toHaveLength(2)
    expect(history[0]).toEqual({ role: "user", content: "User text" })
    expect(history[1]).toEqual({ role: "assistant", content: "AI reply" })
  })
})
