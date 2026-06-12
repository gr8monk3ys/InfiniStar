import { render, screen } from "@testing-library/react"

import CreatorEarningsPage from "@/app/(dashboard)/dashboard/creator-earnings/page"

const mockGetCurrentUser = jest.fn()
const mockCreatorTipFindMany = jest.fn()
const mockCreatorSubscriptionFindMany = jest.fn()
const mockRedirect = jest.fn((destination: string) => {
  throw new Error(`REDIRECT:${destination}`)
})

jest.mock("next/navigation", () => ({
  redirect: (destination: string) => mockRedirect(destination),
}))

jest.mock("@/app/actions/getCurrentUser", () => ({
  __esModule: true,
  default: (...args: unknown[]) => mockGetCurrentUser(...args),
}))

jest.mock("@/app/lib/prismadb", () => ({
  __esModule: true,
  default: {
    creatorTip: {
      findMany: (...args: unknown[]) => mockCreatorTipFindMany(...args),
    },
    creatorSubscription: {
      findMany: (...args: unknown[]) => mockCreatorSubscriptionFindMany(...args),
    },
  },
}))

describe("CreatorEarningsPage kill switch", () => {
  const ORIGINAL_ENV = process.env

  beforeEach(() => {
    jest.clearAllMocks()
    process.env = { ...ORIGINAL_ENV }
    mockGetCurrentUser.mockResolvedValue({ id: "creator-1" })
    mockCreatorTipFindMany.mockResolvedValue([])
    mockCreatorSubscriptionFindMany.mockResolvedValue([])
  })

  afterAll(() => {
    process.env = ORIGINAL_ENV
  })

  it("redirects unauthenticated users to sign-in", async () => {
    mockGetCurrentUser.mockResolvedValue(null)

    await expect(CreatorEarningsPage()).rejects.toThrow("REDIRECT:/sign-in")
  })

  it("shows the coming soon card and skips earnings queries when payments are disabled", async () => {
    delete process.env.NEXT_PUBLIC_ENABLE_CREATOR_PAYMENTS

    render(await CreatorEarningsPage())

    // Page shell is preserved
    expect(screen.getByRole("heading", { name: "Creator Earnings" })).toBeInTheDocument()
    // Coming soon card replaces the dashboard
    expect(screen.getByText("Creator earnings are coming soon")).toBeInTheDocument()
    expect(screen.queryByText("Lifetime Tips")).not.toBeInTheDocument()
    expect(screen.queryByText("Top Supporters")).not.toBeInTheDocument()
    // No database access while the feature is off
    expect(mockCreatorTipFindMany).not.toHaveBeenCalled()
    expect(mockCreatorSubscriptionFindMany).not.toHaveBeenCalled()
  })

  it("renders the earnings dashboard when payments are enabled", async () => {
    process.env.NEXT_PUBLIC_ENABLE_CREATOR_PAYMENTS = "true"

    render(await CreatorEarningsPage())

    expect(screen.getByRole("heading", { name: "Creator Earnings" })).toBeInTheDocument()
    expect(screen.getByText("Lifetime Tips")).toBeInTheDocument()
    expect(screen.getByText("Top Supporters")).toBeInTheDocument()
    expect(screen.queryByText("Creator earnings are coming soon")).not.toBeInTheDocument()
    expect(mockCreatorTipFindMany).toHaveBeenCalled()
    expect(mockCreatorSubscriptionFindMany).toHaveBeenCalled()
  })
})

export {}
