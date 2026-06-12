import { render, screen } from "@testing-library/react"

import { CreatorSupportCard } from "@/app/components/monetization/CreatorSupportCard"

jest.mock("next/navigation", () => ({
  usePathname: () => "/creators/creator-1",
  useRouter: () => ({ replace: jest.fn() }),
  useSearchParams: () => new URLSearchParams(),
}))

jest.mock("react-hot-toast", () => ({
  __esModule: true,
  default: Object.assign(jest.fn(), {
    success: jest.fn(),
    error: jest.fn(),
    loading: jest.fn(),
    dismiss: jest.fn(),
  }),
}))

jest.mock("@/app/hooks/useAppAuth", () => ({
  useAppAuth: () => ({ isSignedIn: true }),
}))

jest.mock("@/app/hooks/useCsrfToken", () => ({
  useCsrfToken: () => ({ token: "csrf-token", loading: false }),
  withCsrfHeader: (_token: string | null, headers: Record<string, string> = {}) => headers,
}))

const baseProps = {
  creatorId: "creator-1",
  creatorName: "Test Creator",
  initialSummary: {
    tipCount: 2,
    tipsTotalCents: 1500,
    activeSubscriberCount: 3,
    monthlyRecurringCents: 2700,
    recentTipCount30d: 1,
  },
  initialViewerSubscription: null,
}

describe("CreatorSupportCard kill switch", () => {
  const ORIGINAL_ENV = process.env

  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV }
  })

  afterAll(() => {
    process.env = ORIGINAL_ENV
  })

  it("renders nothing when creator payments are disabled (default)", () => {
    delete process.env.NEXT_PUBLIC_ENABLE_CREATOR_PAYMENTS

    const { container } = render(<CreatorSupportCard {...baseProps} />)

    expect(container).toBeEmptyDOMElement()
  })

  it("renders nothing when the flag is explicitly false", () => {
    process.env.NEXT_PUBLIC_ENABLE_CREATOR_PAYMENTS = "false"

    const { container } = render(<CreatorSupportCard {...baseProps} />)

    expect(container).toBeEmptyDOMElement()
  })

  it("renders the support card when creator payments are enabled", () => {
    process.env.NEXT_PUBLIC_ENABLE_CREATOR_PAYMENTS = "true"

    render(<CreatorSupportCard {...baseProps} />)

    expect(screen.getByText("Support Test Creator")).toBeInTheDocument()
    expect(screen.getByText("Quick Tip")).toBeInTheDocument()
    expect(screen.getByText("Monthly Membership")).toBeInTheDocument()
  })
})

export {}
