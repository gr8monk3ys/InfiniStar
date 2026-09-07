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

// ---------------------------------------------------------------------------
// Moderation posture
//
// The age gate exists to let consenting adults write explicit fiction with each
// other. Before the posture existed, doing exactly that filed an OPEN
// ContentReport against the chatter's own conversation, so the moderation queue
// filled in proportion to the traffic the gate was built to permit.
//
// The boundary these tests hold: a mature posture suppresses the *sexual review*
// signal and nothing else. Everything that blocks still blocks.
// ---------------------------------------------------------------------------

describe("moderation posture", () => {
  it("flags a consenting-adult sexual phrase for review under the standard posture", () => {
    const result = moderateText("let's write some nsfw", "standard")

    expect(result.shouldReview).toBe(true)
    expect(result.categories).toContain("sexual")
  })

  it("does not flag it under a mature posture", () => {
    const result = moderateText("let's write some nsfw", "mature")

    expect(result.shouldReview).toBe(false)
    expect(result.severity).toBe("safe")
    expect(result.categories).toEqual([])
  })

  it("defaults to the standard posture, so an unmigrated caller is unchanged", () => {
    expect(moderateText("let's write some nsfw").shouldReview).toBe(true)
  })

  // --- the boundary ---

  it.each([
    ["child sexual abuse material", "sexual"],
    ["a rape fantasy scene", "sexual"],
    ["sexual assault fantasy", "sexual"],
  ])("still blocks %s under a mature posture", (content, category) => {
    const result = moderateText(content, "mature")

    expect(result.shouldBlock).toBe(true)
    expect(result.severity).toBe("block")
    expect(result.categories).toContain(category)
  })

  it.each([
    ["you are worthless", "harassment"],
    ["i hate immigrants", "hate"],
    ["i want to hurt myself", "self_harm"],
    ["buy now limited time offer", "spam"],
  ])("still flags %s for review under a mature posture", (content, category) => {
    const result = moderateText(content, "mature")

    expect(result.shouldReview).toBe(true)
    expect(result.categories).toContain(category)
  })

  it("keeps a non-sexual review signal when a sexual one is suppressed alongside it", () => {
    const result = moderateText("nsfw and you are worthless", "mature")

    expect(result.shouldReview).toBe(true)
    expect(result.categories).toContain("harassment")
    expect(result.categories).not.toContain("sexual")
  })
})
