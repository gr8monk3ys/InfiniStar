/**
 * @jest-environment node
 */

import { NextRequest } from "next/server"

const mockAuth = jest.fn()
const mockVerifyCsrfToken = jest.fn()
const mockUserFindUnique = jest.fn()
const mockUserUpdate = jest.fn()
const mockCreatorTipCreate = jest.fn()
const mockCreatorSubscriptionFindUnique = jest.fn()
const mockCreatorSubscriptionUpsert = jest.fn()
const mockCreatorSubscriptionUpdate = jest.fn()
const mockStripeCustomersCreate = jest.fn()
const mockStripeCheckoutSessionsCreate = jest.fn()
const mockStripeSubscriptionsUpdate = jest.fn()

jest.mock("@clerk/nextjs/server", () => ({
  auth: () => mockAuth(),
}))

jest.mock("@/app/lib/csrf", () => ({
  verifyCsrfToken: (...args: unknown[]) => mockVerifyCsrfToken(...args),
}))

jest.mock("@/app/lib/prismadb", () => ({
  __esModule: true,
  default: {
    user: {
      findUnique: (...args: unknown[]) => mockUserFindUnique(...args),
      update: (...args: unknown[]) => mockUserUpdate(...args),
    },
    creatorTip: {
      create: (...args: unknown[]) => mockCreatorTipCreate(...args),
    },
    creatorSubscription: {
      findUnique: (...args: unknown[]) => mockCreatorSubscriptionFindUnique(...args),
      upsert: (...args: unknown[]) => mockCreatorSubscriptionUpsert(...args),
      update: (...args: unknown[]) => mockCreatorSubscriptionUpdate(...args),
    },
  },
}))

jest.mock("@/app/lib/stripe", () => ({
  stripe: {
    customers: {
      create: (...args: unknown[]) => mockStripeCustomersCreate(...args),
    },
    checkout: {
      sessions: {
        create: (...args: unknown[]) => mockStripeCheckoutSessionsCreate(...args),
      },
    },
    subscriptions: {
      update: (...args: unknown[]) => mockStripeSubscriptionsUpdate(...args),
    },
  },
}))

function createRequest(url: string, method: "POST" | "DELETE", body?: Record<string, unknown>) {
  return new NextRequest(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      "X-CSRF-Token": "test-token",
      cookie: "csrf-token=test-token",
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
}

describe("creator support routes", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockAuth.mockResolvedValue({ userId: "clerk_123" })
    mockVerifyCsrfToken.mockReturnValue(true)
    mockStripeCustomersCreate.mockResolvedValue({ id: "cus_test_1" })
    mockStripeCheckoutSessionsCreate.mockResolvedValue({
      id: "cs_test_1",
      url: "https://checkout.stripe.test/session_1",
    })
    mockStripeSubscriptionsUpdate.mockResolvedValue({})
  })

  it("creates a tip for a creator", async () => {
    const { POST } = await import("@/app/api/creators/[creatorId]/tips/route")

    mockUserFindUnique
      .mockResolvedValueOnce({
        id: "supporter-1",
        email: "supporter@example.com",
        name: "Supporter",
        stripeCustomerId: null,
      })
      .mockResolvedValueOnce({ id: "creator-1", name: "Creator" })
    mockCreatorTipCreate.mockResolvedValue({
      id: "tip-1",
      supporterId: "supporter-1",
      creatorId: "creator-1",
      amountCents: 500,
    })

    const request = createRequest("http://localhost:3000/api/creators/creator-1/tips", "POST", {
      amountCents: 500,
      note: "Love your work",
    })

    const response = await POST(request, { params: Promise.resolve({ creatorId: "creator-1" }) })
    expect(response.status).toBe(201)
    expect(mockStripeCustomersCreate).toHaveBeenCalled()
    expect(mockStripeCheckoutSessionsCreate).toHaveBeenCalled()
    expect(mockCreatorTipCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          creatorId: "creator-1",
          supporterId: "supporter-1",
          amountCents: 500,
        }),
      })
    )
  })

  it("rejects self-tipping", async () => {
    const { POST } = await import("@/app/api/creators/[creatorId]/tips/route")

    mockUserFindUnique
      .mockResolvedValueOnce({
        id: "supporter-1",
        email: "supporter@example.com",
        name: "Supporter",
        stripeCustomerId: "cus_existing",
      })
      .mockResolvedValueOnce({ id: "supporter-1", name: "Supporter" })

    const request = createRequest("http://localhost:3000/api/creators/supporter-1/tips", "POST", {
      amountCents: 500,
    })

    const response = await POST(request, { params: Promise.resolve({ creatorId: "supporter-1" }) })
    expect(response.status).toBe(400)
  })

  it("upserts a creator subscription", async () => {
    const { POST } = await import("@/app/api/creators/[creatorId]/subscription/route")

    mockUserFindUnique
      .mockResolvedValueOnce({
        id: "supporter-1",
        email: "supporter@example.com",
        name: "Supporter",
        stripeCustomerId: null,
      })
      .mockResolvedValueOnce({ id: "creator-1", name: "Creator" })
    mockCreatorSubscriptionUpsert.mockResolvedValue({
      id: "sub-1",
      supporterId: "supporter-1",
      creatorId: "creator-1",
      status: "PAUSED",
    })

    const request = createRequest(
      "http://localhost:3000/api/creators/creator-1/subscription",
      "POST",
      {
        tierName: "Supporter",
        amountCents: 900,
        interval: "MONTHLY",
      }
    )

    const response = await POST(request, { params: Promise.resolve({ creatorId: "creator-1" }) })
    expect(response.status).toBe(201)
    expect(mockStripeCheckoutSessionsCreate).toHaveBeenCalled()
    expect(mockCreatorSubscriptionUpsert).toHaveBeenCalled()
  })

  it("cancels an existing subscription", async () => {
    const { DELETE } = await import("@/app/api/creators/[creatorId]/subscription/route")

    mockUserFindUnique.mockResolvedValueOnce({
      id: "supporter-1",
      email: "supporter@example.com",
      name: "Supporter",
      stripeCustomerId: "cus_existing",
    })
    mockCreatorSubscriptionFindUnique.mockResolvedValueOnce({
      id: "sub-1",
      supporterId: "supporter-1",
      creatorId: "creator-1",
      status: "ACTIVE",
      stripeSubscriptionId: "sub_stripe_1",
    })
    mockCreatorSubscriptionUpdate.mockResolvedValue({
      id: "sub-1",
      status: "CANCELED",
    })

    const request = createRequest(
      "http://localhost:3000/api/creators/creator-1/subscription",
      "DELETE"
    )

    const response = await DELETE(request, { params: Promise.resolve({ creatorId: "creator-1" }) })
    expect(response.status).toBe(200)
    expect(mockStripeSubscriptionsUpdate).toHaveBeenCalledWith("sub_stripe_1", {
      cancel_at_period_end: true,
    })
    expect(mockCreatorSubscriptionUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "CANCELED",
        }),
      })
    )
  })
})
