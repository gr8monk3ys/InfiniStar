/**
 * @jest-environment node
 */
import {
  parseAttributionCookie,
  resolveAttribution,
  type AttributionCookie,
} from "@/app/lib/attribution"

describe("parseAttributionCookie", () => {
  it("parses a valid JSON cookie value", () => {
    const raw = JSON.stringify({
      utmSource: "twitter",
      utmMedium: "social",
      utmCampaign: "launch",
      ref: "alice",
      firstTouchAt: "2026-06-01T00:00:00.000Z",
    })
    expect(parseAttributionCookie(raw)).toEqual({
      utmSource: "twitter",
      utmMedium: "social",
      utmCampaign: "launch",
      ref: "alice",
      firstTouchAt: "2026-06-01T00:00:00.000Z",
    })
  })

  it("returns null for undefined, empty, or malformed JSON", () => {
    expect(parseAttributionCookie(undefined)).toBeNull()
    expect(parseAttributionCookie("")).toBeNull()
    expect(parseAttributionCookie("not-json")).toBeNull()
  })

  it("ignores non-string fields and caps overly long values", () => {
    const raw = JSON.stringify({ utmSource: 123, ref: "x".repeat(1000) })
    const parsed = parseAttributionCookie(raw) as AttributionCookie
    expect(parsed.utmSource).toBeUndefined()
    expect(parsed.ref?.length).toBe(255)
  })
})

describe("resolveAttribution", () => {
  const cookie: AttributionCookie = {
    utmSource: "twitter",
    utmMedium: "social",
    utmCampaign: "launch",
    ref: "alice",
    firstTouchAt: "2026-06-01T00:00:00.000Z",
  }

  it("returns the columns to persist for an un-attributed user", () => {
    const result = resolveAttribution(cookie, {
      utmSource: null,
      utmMedium: null,
      utmCampaign: null,
      referralSource: null,
      firstTouchAt: null,
    })
    expect(result).toEqual({
      utmSource: "twitter",
      utmMedium: "social",
      utmCampaign: "launch",
      referralSource: "alice",
      firstTouchAt: new Date("2026-06-01T00:00:00.000Z"),
    })
  })

  it("returns an empty object when the user is already attributed (first-touch wins)", () => {
    const result = resolveAttribution(cookie, {
      utmSource: "google",
      utmMedium: null,
      utmCampaign: null,
      referralSource: null,
      firstTouchAt: new Date("2026-05-01T00:00:00.000Z"),
    })
    expect(result).toEqual({})
  })

  it("treats firstTouchAt alone as 'already attributed'", () => {
    const result = resolveAttribution(cookie, {
      utmSource: null,
      utmMedium: null,
      utmCampaign: null,
      referralSource: null,
      firstTouchAt: new Date("2026-05-01T00:00:00.000Z"),
    })
    expect(result).toEqual({})
  })

  it("returns an empty object when there is no cookie", () => {
    expect(
      resolveAttribution(null, {
        utmSource: null,
        utmMedium: null,
        utmCampaign: null,
        referralSource: null,
        firstTouchAt: null,
      })
    ).toEqual({})
  })

  it("falls back to a synthesized firstTouchAt when the cookie omits it", () => {
    const result = resolveAttribution(
      { utmSource: "reddit" },
      {
        utmSource: null,
        utmMedium: null,
        utmCampaign: null,
        referralSource: null,
        firstTouchAt: null,
      }
    )
    expect(result.utmSource).toBe("reddit")
    expect(result.firstTouchAt).toBeInstanceOf(Date)
  })

  it("ignores an unparseable firstTouchAt but still persists source fields", () => {
    const result = resolveAttribution(
      { utmSource: "reddit", firstTouchAt: "garbage" },
      {
        utmSource: null,
        utmMedium: null,
        utmCampaign: null,
        referralSource: null,
        firstTouchAt: null,
      }
    )
    expect(result.utmSource).toBe("reddit")
    expect(result.firstTouchAt).toBeInstanceOf(Date)
  })
})

export {}
