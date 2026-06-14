/**
 * @jest-environment node
 */
import {
  ATTRIBUTION_COOKIE_NAME,
  parseAttributionFromSearch,
  readAttributionCookie,
  serializeAttributionCookie,
  type AttributionPayload,
} from "@/app/lib/attribution"

describe("attribution helpers", () => {
  describe("ATTRIBUTION_COOKIE_NAME", () => {
    it("is the shared contract name", () => {
      expect(ATTRIBUTION_COOKIE_NAME).toBe("ist_attribution")
    })
  })

  describe("parseAttributionFromSearch", () => {
    it("returns null when no attribution params are present", () => {
      expect(parseAttributionFromSearch("?foo=bar&baz=1")).toBeNull()
      expect(parseAttributionFromSearch("")).toBeNull()
    })

    it("parses utm params and ref, with an ISO firstTouchAt", () => {
      const result = parseAttributionFromSearch(
        "?utm_source=twitter&utm_medium=social&utm_campaign=launch&ref=alice"
      )
      expect(result).not.toBeNull()
      expect(result?.utmSource).toBe("twitter")
      expect(result?.utmMedium).toBe("social")
      expect(result?.utmCampaign).toBe("launch")
      expect(result?.ref).toBe("alice")
      expect(typeof result?.firstTouchAt).toBe("string")
      expect(Number.isNaN(Date.parse(result!.firstTouchAt))).toBe(false)
    })

    it("accepts a leading '?' or a bare query string", () => {
      expect(parseAttributionFromSearch("utm_source=x")?.utmSource).toBe("x")
      expect(parseAttributionFromSearch("?utm_source=x")?.utmSource).toBe("x")
    })

    it("returns null when only blank/whitespace values are present", () => {
      expect(parseAttributionFromSearch("?utm_source=&ref=%20")).toBeNull()
    })

    it("omits absent optional keys (no undefined-stringified values)", () => {
      const result = parseAttributionFromSearch("?ref=bob")
      expect(result).toEqual({ ref: "bob", firstTouchAt: expect.any(String) })
      expect("utmSource" in (result as object)).toBe(false)
    })
  })

  describe("readAttributionCookie", () => {
    it("returns null when the cookie is absent", () => {
      expect(readAttributionCookie("other=1; foo=bar")).toBeNull()
      expect(readAttributionCookie("")).toBeNull()
    })

    it("decodes a URL-encoded JSON cookie value", () => {
      const payload: AttributionPayload = { ref: "alice", firstTouchAt: "2026-01-01T00:00:00.000Z" }
      const cookie = `ist_attribution=${encodeURIComponent(JSON.stringify(payload))}; theme=dark`
      expect(readAttributionCookie(cookie)).toEqual(payload)
    })

    it("returns null on malformed JSON instead of throwing", () => {
      expect(readAttributionCookie("ist_attribution=%7Bnot-json")).toBeNull()
    })
  })

  describe("serializeAttributionCookie", () => {
    it("produces a first-party Set-Cookie style string with the contract name", () => {
      const payload: AttributionPayload = {
        utmSource: "x",
        firstTouchAt: "2026-01-01T00:00:00.000Z",
      }
      const serialized = serializeAttributionCookie(payload)
      expect(serialized.startsWith("ist_attribution=")).toBe(true)
      expect(serialized).toContain("path=/")
      expect(serialized).toContain("samesite=lax")
      expect(serialized).toContain("max-age=")
      // round-trips back through the reader
      const cookieHeader = serialized.split(";")[0]
      expect(readAttributionCookie(cookieHeader)).toEqual(payload)
    })
  })
})
