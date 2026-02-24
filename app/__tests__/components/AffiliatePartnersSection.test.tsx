import "@testing-library/jest-dom"

import { render, screen } from "@testing-library/react"

import { AffiliatePartnersSection } from "@/app/components/monetization/AffiliatePartnersSection"

jest.mock("@/app/lib/monetization", () => ({
  monetizationConfig: {
    enableAffiliateLinks: false,
    enableAdSense: false,
    adSenseClientId: "",
    adSenseSlots: { homeInline: "", pricingInline: "" },
  },
  affiliatePartners: [],
  buildAffiliateRedirectPath: (partnerId: string, sourcePage: string) => {
    const source = sourcePage
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, "-")
    return `/api/affiliate/${partnerId}?source=${source}`
  },
}))

const monetizationMock = jest.requireMock("@/app/lib/monetization") as {
  monetizationConfig: {
    enableAffiliateLinks: boolean
    enableAdSense: boolean
    adSenseClientId: string
    adSenseSlots: { homeInline: string; pricingInline: string }
  }
  affiliatePartners: Array<{
    id: string
    name: string
    description: string
    ctaLabel: string
    url: string
  }>
}

const mockMonetizationConfig = monetizationMock.monetizationConfig
const mockAffiliatePartners = monetizationMock.affiliatePartners

describe("AffiliatePartnersSection", () => {
  beforeEach(() => {
    mockMonetizationConfig.enableAffiliateLinks = false
    mockAffiliatePartners.length = 0
  })

  it("does not render when feature flag is disabled", () => {
    mockMonetizationConfig.enableAffiliateLinks = false
    mockAffiliatePartners.push({
      id: "anthropic",
      name: "Claude Pro",
      description: "desc",
      ctaLabel: "View Claude Pro",
      url: "https://example.com/claude",
    })

    const { container } = render(<AffiliatePartnersSection sourcePage="pricing" />)
    expect(container).toBeEmptyDOMElement()
  })

  it("renders links to internal tracking endpoint when enabled", () => {
    mockMonetizationConfig.enableAffiliateLinks = true
    mockAffiliatePartners.push(
      {
        id: "anthropic",
        name: "Claude Pro",
        description: "Upgrade for higher message limits.",
        ctaLabel: "View Claude Pro",
        url: "https://example.com/claude",
      },
      {
        id: "grammarly",
        name: "Grammarly",
        description: "Improve tone and clarity.",
        ctaLabel: "View Grammarly",
        url: "https://example.com/grammarly",
      }
    )

    render(<AffiliatePartnersSection sourcePage="Pricing Page" />)

    const claudeLink = screen.getByRole("link", { name: /view claude pro/i })
    expect(claudeLink).toHaveAttribute("href", "/api/affiliate/anthropic?source=pricing-page")
    expect(claudeLink).toHaveAttribute("target", "_blank")

    const grammarlyLink = screen.getByRole("link", { name: /view grammarly/i })
    expect(grammarlyLink).toHaveAttribute("href", "/api/affiliate/grammarly?source=pricing-page")
  })
})

export {}
