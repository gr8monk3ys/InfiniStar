import { render, screen } from "@testing-library/react"

import { FreePlanCta, ProPlanCta } from "@/app/(marketing)/pricing/PricingCta"

const mockUseAppAuth = jest.fn()

jest.mock("@/app/hooks/useAppAuth", () => ({
  useAppAuth: () => mockUseAppAuth(),
}))

jest.mock("@/app/hooks/useCsrfToken", () => ({
  useCsrfToken: () => ({ token: "csrf-token", loading: false }),
}))

function auth(overrides: Partial<{ isLoaded: boolean; isSignedInHint: boolean; isPro: boolean }>) {
  const { isLoaded = true, isSignedInHint = false, isPro = false } = overrides
  mockUseAppAuth.mockReturnValue({
    isLoaded,
    isSignedInHint,
    viewer: { canViewMature: false, isPro },
  })
}

// The pricing page is prerendered with the signed-out buttons; these pin how
// the client resolves them, and that a PRO user is never sent to checkout on
// a guess.
describe("pricing plan CTAs", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("renders the signed-out buttons before anything is known", () => {
    auth({ isLoaded: false, isSignedInHint: false })

    render(
      <>
        <FreePlanCta />
        <ProPlanCta />
      </>
    )

    expect(screen.getByRole("link", { name: "Create Free Account" })).toHaveAttribute(
      "href",
      "/sign-up"
    )
    expect(screen.getByRole("link", { name: "Upgrade to PRO" })).toHaveAttribute("href", "/sign-up")
  })

  it("switches to the account buttons on the cookie hint and holds the PRO button until the plan is known", () => {
    auth({ isLoaded: false, isSignedInHint: true })

    render(
      <>
        <FreePlanCta />
        <ProPlanCta />
      </>
    )

    expect(screen.getByRole("link", { name: "Go to Dashboard" })).toHaveAttribute(
      "href",
      "/dashboard"
    )
    expect(screen.getByRole("button", { name: "Upgrade to PRO" })).toBeDisabled()
  })

  it("offers checkout to a signed-in free user once the session is loaded", () => {
    auth({ isLoaded: true, isSignedInHint: true, isPro: false })

    render(<ProPlanCta />)

    expect(screen.getByRole("button", { name: "Upgrade to PRO" })).toBeEnabled()
  })

  it("offers billing management to a PRO user once the session is loaded", () => {
    auth({ isLoaded: true, isSignedInHint: true, isPro: true })

    render(<ProPlanCta />)

    expect(screen.getByRole("button", { name: "Manage Billing" })).toBeEnabled()
  })
})
