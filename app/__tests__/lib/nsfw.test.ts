import { canAccessNsfw } from "@/app/lib/nsfw"

describe("canAccessNsfw", () => {
  it("returns false for null user", () => {
    expect(canAccessNsfw(null)).toBe(false)
  })

  it("returns false when isAdult is false", () => {
    expect(canAccessNsfw({ isAdult: false, nsfwEnabled: true, adultConfirmedAt: new Date() })).toBe(
      false
    )
  })

  it("returns false when nsfwEnabled is false", () => {
    expect(canAccessNsfw({ isAdult: true, nsfwEnabled: false, adultConfirmedAt: new Date() })).toBe(
      false
    )
  })

  it("returns false when adultConfirmedAt is null (no consent timestamp)", () => {
    expect(canAccessNsfw({ isAdult: true, nsfwEnabled: true, adultConfirmedAt: null })).toBe(false)
  })

  it("returns true when all three conditions are met", () => {
    expect(canAccessNsfw({ isAdult: true, nsfwEnabled: true, adultConfirmedAt: new Date() })).toBe(
      true
    )
  })
})
