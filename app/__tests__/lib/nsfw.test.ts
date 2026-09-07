import { canAccessNsfw, matureAccess } from "@/app/lib/nsfw"

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

// ---------------------------------------------------------------------------
// The posture
// ---------------------------------------------------------------------------

describe("matureAccess", () => {
  const CONFIRMED_ADULT = {
    isAdult: true,
    nsfwEnabled: true,
    adultConfirmedAt: new Date("2026-01-01"),
  }

  it("grants everything to an account holding both facts", () => {
    const access = matureAccess(CONFIRMED_ADULT)

    expect(access.canView).toBe(true)
    expect(access.canAuthor).toBe(true)
    expect(access.moderationPosture).toBe("mature")
    expect(access.visibilityFilter).toEqual({})
  })

  /**
   * CONTEXT.md: "the two are separate facts and both are required". Publishing
   * used to check `isAdult` alone, so this account could publish a Character it
   * was itself filtered out of seeing.
   */
  it("refuses authoring to an adult who has not opted in", () => {
    const access = matureAccess({
      isAdult: true,
      nsfwEnabled: false,
      adultConfirmedAt: new Date("2026-01-01"),
    })

    expect(access.canView).toBe(false)
    expect(access.canAuthor).toBe(false)
  })

  it("refuses authoring to an opted-in account that never confirmed adulthood", () => {
    expect(
      matureAccess({ isAdult: true, nsfwEnabled: true, adultConfirmedAt: null }).canAuthor
    ).toBe(false)
  })

  it("filters mature characters out of listings for everyone else", () => {
    expect(matureAccess(null).visibilityFilter).toEqual({ isNsfw: false })
    expect(matureAccess(null).moderationPosture).toBe("standard")
  })

  it("agrees with canAccessNsfw", () => {
    for (const viewer of [CONFIRMED_ADULT, { isAdult: true }, null, undefined]) {
      expect(matureAccess(viewer).canView).toBe(canAccessNsfw(viewer))
    }
  })
})
