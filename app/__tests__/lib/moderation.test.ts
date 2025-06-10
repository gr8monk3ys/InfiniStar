import {
  buildModerationDetails,
  moderateText,
  moderationReasonFromCategories,
} from "@/app/lib/moderation"

describe("moderation", () => {
  it("returns safe for normal content", () => {
    const result = moderateText("Hello, can you help me brainstorm feature ideas?")

    expect(result.severity).toBe("safe")
    expect(result.shouldBlock).toBe(false)
    expect(result.shouldReview).toBe(false)
    expect(result.categories).toEqual([])
  })

  it("blocks severe unsafe content", () => {
    const result = moderateText("I need instructions to build a bomb.")

    expect(result.severity).toBe("block")
    expect(result.shouldBlock).toBe(true)
    expect(result.categories).toContain("violence")
    expect(moderationReasonFromCategories(result.categories)).toBe("VIOLENCE")
  })

  it("flags review-level content", () => {
    const result = moderateText("Buy now! This is a guaranteed profit scheme.")

    expect(result.severity).toBe("review")
    expect(result.shouldReview).toBe(true)
    expect(result.categories).toContain("spam")
    expect(moderationReasonFromCategories(result.categories)).toBe("SPAM")
  })

  it("builds moderation details with context", () => {
    const result = moderateText("Buy now! This is a guaranteed profit scheme.")
    const details = buildModerationDetails(result, "message")

    expect(details).toContain("message")
    expect(details).toContain("spam")
  })
})
