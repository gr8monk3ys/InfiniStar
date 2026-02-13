import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { ApiError } from "@/app/lib/api-client"
import { navigateTo } from "@/app/lib/navigation"
import { PricingCtaButton } from "@/app/(marketing)/pricing/PricingCtaButton"

const mockPost = jest.fn()
const mockToastError = jest.fn()

jest.mock("@/app/lib/api-client", () => {
  class MockApiError extends Error {
    public statusCode?: number
    constructor(message: string, statusCode?: number) {
      super(message)
      this.name = "ApiError"
      this.statusCode = statusCode
    }
  }

  return {
    api: {
      post: (...args: unknown[]) => mockPost(...args),
    },
    ApiError: MockApiError,
  }
})

jest.mock("react-hot-toast", () => ({
  __esModule: true,
  default: {
    error: (...args: unknown[]) => mockToastError(...args),
  },
}))

jest.mock("@/app/hooks/useCsrfToken", () => ({
  useCsrfToken: jest.fn(() => ({
    token: "csrf-token",
    loading: false,
  })),
}))

jest.mock("@/app/lib/navigation", () => ({
  navigateTo: jest.fn(),
}))

describe("PricingCtaButton", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("renders sign-in link when user is signed out", () => {
    render(<PricingCtaButton isSignedIn={false} isPro={false} />)

    const link = screen.getByRole("link", { name: /upgrade to pro/i })
    expect(link).toHaveAttribute("href", "/sign-in")
  })

  it("calls checkout endpoint for non-PRO users", async () => {
    mockPost.mockResolvedValue({ url: "https://checkout.stripe.test/session_1" })
    const user = userEvent.setup()

    render(<PricingCtaButton isSignedIn={true} isPro={false} />)
    await user.click(screen.getByRole("button", { name: /upgrade to pro/i }))

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith(
        "/api/stripe/checkout",
        {},
        expect.objectContaining({
          headers: { "X-CSRF-Token": "csrf-token" },
        })
      )
      expect(navigateTo).toHaveBeenCalledWith("https://checkout.stripe.test/session_1")
    })
  })

  it("calls portal endpoint for PRO users", async () => {
    mockPost.mockResolvedValue({ url: "https://billing.stripe.test/session_1" })
    const user = userEvent.setup()

    render(<PricingCtaButton isSignedIn={true} isPro={true} />)
    await user.click(screen.getByRole("button", { name: /manage billing/i }))

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith(
        "/api/stripe/portal",
        {},
        expect.objectContaining({
          headers: { "X-CSRF-Token": "csrf-token" },
        })
      )
      expect(navigateTo).toHaveBeenCalledWith("https://billing.stripe.test/session_1")
    })
  })

  it("falls back to portal when checkout reports active subscription", async () => {
    mockPost
      .mockRejectedValueOnce(new ApiError("User already has an active subscription", 400))
      .mockResolvedValueOnce({ url: "https://billing.stripe.test/session_active" })
    const user = userEvent.setup()

    render(<PricingCtaButton isSignedIn={true} isPro={false} />)
    await user.click(screen.getByRole("button", { name: /upgrade to pro/i }))

    await waitFor(() => {
      expect(mockPost).toHaveBeenNthCalledWith(
        1,
        "/api/stripe/checkout",
        {},
        expect.objectContaining({
          headers: { "X-CSRF-Token": "csrf-token" },
        })
      )
      expect(mockPost).toHaveBeenNthCalledWith(
        2,
        "/api/stripe/portal",
        {},
        expect.objectContaining({
          headers: { "X-CSRF-Token": "csrf-token" },
        })
      )
      expect(navigateTo).toHaveBeenCalledWith("https://billing.stripe.test/session_active")
    })
  })

  it("shows error when CSRF token is unavailable", async () => {
    const { useCsrfToken } = jest.requireMock("@/app/hooks/useCsrfToken") as {
      useCsrfToken: jest.Mock
    }
    useCsrfToken.mockReturnValue({
      token: null,
      loading: false,
    })

    const user = userEvent.setup()
    render(<PricingCtaButton isSignedIn={true} isPro={false} />)
    await user.click(screen.getByRole("button", { name: /upgrade to pro/i }))

    expect(mockPost).not.toHaveBeenCalled()
    expect(mockToastError).toHaveBeenCalledWith(
      "Unable to load security token. Please refresh and try again."
    )
  })
})

export {}
