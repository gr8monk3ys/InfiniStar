import { render, screen } from "@testing-library/react"

describe("AffiliatePartnersSection", () => {
  const originalEnv = process.env

  beforeEach(() => {
    jest.resetModules()
    process.env = { ...originalEnv }
  })

  afterAll(() => {
    process.env = originalEnv
  })

  it("does not render when feature flag is disabled", async () => {
    process.env.NEXT_PUBLIC_ENABLE_AFFILIATE_LINKS = "false"
    process.env.NEXT_PUBLIC_AFFILIATE_ANTHROPIC_URL = "https://example.com/claude"

    const { AffiliatePartnersSection } =
      await import("@/app/components/monetization/AffiliatePartnersSection")

    const { container } = render(<AffiliatePartnersSection sourcePage="pricing" />)
    expect(container).toBeEmptyDOMElement()
  })

  it("renders links to internal tracking endpoint when enabled", async () => {
    process.env.NEXT_PUBLIC_ENABLE_AFFILIATE_LINKS = "true"
    process.env.NEXT_PUBLIC_AFFILIATE_ANTHROPIC_URL = "https://example.com/claude"
    process.env.NEXT_PUBLIC_AFFILIATE_NOTION_URL = ""
    process.env.NEXT_PUBLIC_AFFILIATE_GRAMMARLY_URL = "https://example.com/grammarly"

    const { AffiliatePartnersSection } =
      await import("@/app/components/monetization/AffiliatePartnersSection")

    render(<AffiliatePartnersSection sourcePage="Pricing Page" />)

    const claudeLink = screen.getByRole("link", { name: /view claude pro/i })
    expect(claudeLink).toHaveAttribute("href", "/api/affiliate/anthropic?source=pricing-page")
    expect(claudeLink).toHaveAttribute("target", "_blank")

    const grammarlyLink = screen.getByRole("link", { name: /view grammarly/i })
    expect(grammarlyLink).toHaveAttribute("href", "/api/affiliate/grammarly?source=pricing-page")
  })
})

export {}
