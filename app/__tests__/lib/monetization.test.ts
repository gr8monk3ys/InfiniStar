/**
 * @jest-environment node
 */

describe("monetization helpers", () => {
  const originalEnv = process.env

  beforeEach(() => {
    jest.resetModules()
    process.env = { ...originalEnv }
  })

  afterAll(() => {
    process.env = originalEnv
  })

  it("adds UTM parameters to affiliate URLs", async () => {
    const { buildAffiliateUrl } = await import("@/app/lib/monetization")

    const url = buildAffiliateUrl("https://example.com/product", "pricing", "anthropic")
    const parsed = new URL(url)

    expect(parsed.searchParams.get("utm_source")).toBe("infinistar")
    expect(parsed.searchParams.get("utm_medium")).toBe("affiliate")
    expect(parsed.searchParams.get("utm_campaign")).toBe("pricing")
    expect(parsed.searchParams.get("utm_content")).toBe("anthropic")
  })

  it("does not overwrite existing UTM parameters", async () => {
    const { buildAffiliateUrl } = await import("@/app/lib/monetization")

    const url = buildAffiliateUrl(
      "https://example.com/product?utm_source=custom&utm_medium=email",
      "homepage",
      "notion"
    )
    const parsed = new URL(url)

    expect(parsed.searchParams.get("utm_source")).toBe("custom")
    expect(parsed.searchParams.get("utm_medium")).toBe("email")
    expect(parsed.searchParams.get("utm_campaign")).toBe("homepage")
    expect(parsed.searchParams.get("utm_content")).toBe("notion")
  })

  it("returns original value for invalid URLs", async () => {
    const { buildAffiliateUrl } = await import("@/app/lib/monetization")

    const input = "not-a-valid-url"
    expect(buildAffiliateUrl(input, "homepage", "partner")).toBe(input)
  })

  it("evaluates feature flags from environment values", async () => {
    process.env.NEXT_PUBLIC_ENABLE_AFFILIATE_LINKS = "true"
    process.env.NEXT_PUBLIC_ENABLE_ADSENSE = "1"
    process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID = "ca-pub-test"
    process.env.NEXT_PUBLIC_ADSENSE_SLOT_HOME_INLINE = "1111"

    const { monetizationConfig } = await import("@/app/lib/monetization")

    expect(monetizationConfig.enableAffiliateLinks).toBe(true)
    expect(monetizationConfig.enableAdSense).toBe(true)
    expect(monetizationConfig.adSenseClientId).toBe("ca-pub-test")
    expect(monetizationConfig.adSenseSlots.homeInline).toBe("1111")
  })

  it("filters affiliate partners with empty URLs", async () => {
    process.env.NEXT_PUBLIC_AFFILIATE_ANTHROPIC_URL = "https://example.com/claude"
    process.env.NEXT_PUBLIC_AFFILIATE_NOTION_URL = ""
    process.env.NEXT_PUBLIC_AFFILIATE_GRAMMARLY_URL = "https://example.com/grammarly"

    const { affiliatePartners } = await import("@/app/lib/monetization")

    expect(affiliatePartners.map((partner) => partner.id)).toEqual(["anthropic", "grammarly"])
  })

  it("builds a first-party affiliate redirect path", async () => {
    const { buildAffiliateRedirectPath } = await import("@/app/lib/monetization")

    expect(buildAffiliateRedirectPath("anthropic", "Pricing Page")).toBe(
      "/api/affiliate/anthropic?source=pricing-page"
    )
  })

  it("normalizes blank or invalid source values", async () => {
    const { normalizeAffiliateSource } = await import("@/app/lib/monetization")

    expect(normalizeAffiliateSource("   ")).toBe("unknown")
    expect(normalizeAffiliateSource("!!")).toBe("unknown")
    expect(normalizeAffiliateSource("Home + Pricing")).toBe("home-pricing")
  })

  it("finds affiliate partners by ID", async () => {
    process.env.NEXT_PUBLIC_AFFILIATE_ANTHROPIC_URL = "https://example.com/claude"
    process.env.NEXT_PUBLIC_AFFILIATE_NOTION_URL = ""
    process.env.NEXT_PUBLIC_AFFILIATE_GRAMMARLY_URL = ""

    const { getAffiliatePartner } = await import("@/app/lib/monetization")

    expect(getAffiliatePartner("anthropic")?.id).toBe("anthropic")
    expect(getAffiliatePartner("missing")).toBeNull()
  })
})

export {}
