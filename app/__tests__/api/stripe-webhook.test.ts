/**
 * @jest-environment node
 */

/**
 * API Route Tests: Stripe Webhook
 *
 * Tests POST /api/webhooks/stripe
 */

// ---- Imports ----

import { headers } from "next/headers"

import prisma from "@/app/lib/prismadb"
import { stripe } from "@/app/lib/stripe"
import { POST } from "@/app/api/webhooks/stripe/route"

// ---- Mocks ----

jest.mock("@/app/lib/prismadb", () => ({
  __esModule: true,
  default: {
    user: { findUnique: jest.fn(), update: jest.fn() },
  },
}))

jest.mock("@/app/lib/stripe", () => ({
  stripe: {
    webhooks: { constructEvent: jest.fn() },
    subscriptions: { retrieve: jest.fn() },
  },
}))

jest.mock("@/app/lib/logger", () => ({
  stripeLogger: {
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
  },
}))

jest.mock("next/headers", () => ({
  headers: jest.fn(),
}))

// ---- Helpers ----

const originalEnv = process.env

function createWebhookRequest(body = "{}"): Request {
  return new Request("http://localhost:3000/api/webhooks/stripe", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Stripe-Signature": "sig_test_123",
    },
    body,
  })
}

const mockSubscription = {
  id: "sub_123",
  customer: "cus_123",
  status: "active",
  items: {
    data: [
      {
        price: { id: "price_pro" },
        current_period_end: Math.floor(Date.now() / 1000) + 86400 * 30,
      },
    ],
  },
}

// ---- Tests ----

beforeEach(() => {
  jest.clearAllMocks()
  process.env = { ...originalEnv, STRIPE_WEBHOOK_SECRET: "whsec_test" }
  ;(headers as jest.Mock).mockResolvedValue({
    get: (name: string) => {
      if (name === "Stripe-Signature") return "sig_test_123"
      return null
    },
  })
})

afterAll(() => {
  process.env = originalEnv
})

describe("POST /api/webhooks/stripe", () => {
  it("returns 500 when STRIPE_WEBHOOK_SECRET is not configured", async () => {
    delete process.env.STRIPE_WEBHOOK_SECRET

    const response = await POST(createWebhookRequest())
    expect(response.status).toBe(500)
  })

  it("returns 400 when Stripe-Signature header is missing", async () => {
    ;(headers as jest.Mock).mockResolvedValue({
      get: () => null,
    })

    const response = await POST(createWebhookRequest())
    expect(response.status).toBe(400)
  })

  it("returns 400 for invalid signature", async () => {
    ;(stripe.webhooks.constructEvent as jest.Mock).mockImplementation(() => {
      throw new Error("Invalid signature")
    })

    const response = await POST(createWebhookRequest())
    expect(response.status).toBe(400)

    const text = await response.text()
    expect(text).toContain("Invalid signature")
  })

  it("handles checkout.session.completed", async () => {
    ;(stripe.webhooks.constructEvent as jest.Mock).mockReturnValue({
      type: "checkout.session.completed",
      data: {
        object: {
          subscription: "sub_123",
          metadata: { userId: "user-1" },
        },
      },
    })
    ;(stripe.subscriptions.retrieve as jest.Mock).mockResolvedValue(mockSubscription)
    ;(prisma.user.update as jest.Mock).mockResolvedValue({})

    const response = await POST(createWebhookRequest())
    expect(response.status).toBe(200)

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: expect.objectContaining({
        stripeSubscriptionId: "sub_123",
        stripeCustomerId: "cus_123",
        stripePriceId: "price_pro",
      }),
    })
  })

  it("handles invoice.payment_succeeded", async () => {
    ;(stripe.webhooks.constructEvent as jest.Mock).mockReturnValue({
      type: "invoice.payment_succeeded",
      data: {
        object: {
          parent: {
            subscription_details: {
              subscription: "sub_123",
            },
          },
        },
      },
    })
    ;(stripe.subscriptions.retrieve as jest.Mock).mockResolvedValue(mockSubscription)
    ;(prisma.user.findUnique as jest.Mock).mockResolvedValue({
      id: "user-1",
      stripeCustomerId: "cus_123",
    })
    ;(prisma.user.update as jest.Mock).mockResolvedValue({})

    const response = await POST(createWebhookRequest())
    expect(response.status).toBe(200)

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: expect.objectContaining({
        stripePriceId: "price_pro",
      }),
    })
  })

  it("handles customer.subscription.deleted - downgrades user", async () => {
    ;(stripe.webhooks.constructEvent as jest.Mock).mockReturnValue({
      type: "customer.subscription.deleted",
      data: {
        object: {
          id: "sub_123",
          customer: "cus_123",
          status: "canceled",
          items: mockSubscription.items,
        },
      },
    })
    ;(prisma.user.findUnique as jest.Mock).mockResolvedValue({
      id: "user-1",
      stripeCustomerId: "cus_123",
    })
    ;(prisma.user.update as jest.Mock).mockResolvedValue({})

    const response = await POST(createWebhookRequest())
    expect(response.status).toBe(200)

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: expect.objectContaining({
        stripeSubscriptionId: null,
        stripePriceId: null,
        stripeCurrentPeriodEnd: null,
      }),
    })
  })

  it("returns 200 for unknown event types", async () => {
    ;(stripe.webhooks.constructEvent as jest.Mock).mockReturnValue({
      type: "some.unknown.event",
      data: { object: {} },
    })

    const response = await POST(createWebhookRequest())
    expect(response.status).toBe(200)
  })

  it("handles checkout with deleted subscription gracefully", async () => {
    ;(stripe.webhooks.constructEvent as jest.Mock).mockReturnValue({
      type: "checkout.session.completed",
      data: {
        object: {
          subscription: "sub_deleted",
          metadata: { userId: "user-1" },
        },
      },
    })
    ;(stripe.subscriptions.retrieve as jest.Mock).mockResolvedValue({
      deleted: true,
    })

    const response = await POST(createWebhookRequest())
    expect(response.status).toBe(200)
    expect(prisma.user.update).not.toHaveBeenCalled()
  })
})

export {}
