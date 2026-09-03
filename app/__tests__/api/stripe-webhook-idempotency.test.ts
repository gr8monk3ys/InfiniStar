/**
 * @jest-environment node
 */

/**
 * API Route Tests: Stripe Webhook Idempotency Guard
 *
 * The guard used to live only in Redis, which is optional (`REDIS_URL`). With
 * Redis absent it silently disappeared and every Stripe retry re-ran the
 * handlers. It is now a row in Postgres, claimed with an INSERT before any side
 * effect runs, and a duplicate is detected by the unique-constraint violation
 * (Prisma `P2002`) rather than by a prior read.
 */

// ---- Imports ----

import { headers } from "next/headers"

import { stripeLogger } from "@/app/lib/logger"
import prisma from "@/app/lib/prismadb"
import { getRedisClient } from "@/app/lib/redis"
import { stripe } from "@/app/lib/stripe"
import { POST } from "@/app/api/webhooks/stripe/route"

// ---- Mocks ----

jest.mock("@/app/lib/prismadb", () => ({
  __esModule: true,
  default: {
    user: { findFirst: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
    creatorSubscription: { updateMany: jest.fn(), upsert: jest.fn() },
    creatorTip: { upsert: jest.fn() },
    processedWebhookEvent: { create: jest.fn(), deleteMany: jest.fn() },
  },
}))

jest.mock("@/app/lib/stripe", () => ({
  stripe: {
    webhooks: { constructEvent: jest.fn() },
    subscriptions: { retrieve: jest.fn() },
  },
}))

jest.mock("@/app/lib/logger", () => ({
  stripeLogger: { error: jest.fn(), info: jest.fn(), warn: jest.fn() },
  dbLogger: { error: jest.fn(), info: jest.fn(), warn: jest.fn() },
}))

// The whole point of the change: the route must behave identically with no
// Redis at all. Every test in this file runs with getRedisClient() -> null.
jest.mock("@/app/lib/redis", () => ({
  getRedisClient: jest.fn(() => null),
}))

jest.mock("@/app/lib/analytics", () => ({
  captureServerEvent: jest.fn(),
}))

jest.mock("next/headers", () => ({
  headers: jest.fn(),
}))

// ---- Helpers ----

const originalEnv = process.env

const EVENT_ID = "evt_idempotency_1"

/** Shape of the error Prisma throws on a unique-constraint violation. */
function uniqueConstraintError(): Error & { code: string } {
  const error = new Error(
    "Unique constraint failed on the fields: (`provider`,`eventId`)"
  ) as Error & { code: string }
  error.code = "P2002"
  return error
}

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

/** A platform PRO checkout completion -- the handler writes to prisma.user. */
function mockProCheckoutEvent(): void {
  ;(stripe.webhooks.constructEvent as jest.Mock).mockReturnValue({
    id: EVENT_ID,
    type: "checkout.session.completed",
    data: {
      object: {
        id: "cs_123",
        subscription: "sub_123",
        metadata: { userId: "user-1" },
      },
    },
  })
  ;(stripe.subscriptions.retrieve as jest.Mock).mockResolvedValue(mockSubscription)
  ;(prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: "user-1" })
  ;(prisma.user.update as jest.Mock).mockResolvedValue({})
}

// ---- Tests ----

beforeEach(() => {
  jest.clearAllMocks()
  ;(getRedisClient as jest.Mock).mockReturnValue(null)
  process.env = {
    ...originalEnv,
    STRIPE_WEBHOOK_SECRET: "whsec_test",
    STRIPE_PRO_MONTHLY_PLAN_ID: "price_pro",
  }
  ;(headers as jest.Mock).mockResolvedValue({
    get: (name: string) => (name === "Stripe-Signature" ? "sig_test_123" : null),
  })
})

afterAll(() => {
  process.env = originalEnv
})

describe("POST /api/webhooks/stripe -- idempotency without Redis", () => {
  it("processes a first delivery and records the event before the side effects", async () => {
    mockProCheckoutEvent()
    ;(prisma.processedWebhookEvent.create as jest.Mock).mockResolvedValue({ id: "row-1" })

    const response = await POST(createWebhookRequest())

    expect(response.status).toBe(200)
    expect(prisma.processedWebhookEvent.create).toHaveBeenCalledWith({
      data: {
        provider: "stripe",
        eventId: EVENT_ID,
        eventType: "checkout.session.completed",
      },
    })
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: expect.objectContaining({ stripeSubscriptionId: "sub_123" }),
    })

    // The claim must be committed before any side effect runs.
    const claimOrder = (prisma.processedWebhookEvent.create as jest.Mock).mock
      .invocationCallOrder[0]
    const updateOrder = (prisma.user.update as jest.Mock).mock.invocationCallOrder[0]
    expect(claimOrder).toBeLessThan(updateOrder)
  })

  it("skips a duplicate delivery (P2002) without re-running the handlers", async () => {
    mockProCheckoutEvent()
    ;(prisma.processedWebhookEvent.create as jest.Mock).mockRejectedValue(uniqueConstraintError())

    const response = await POST(createWebhookRequest())

    expect(response.status).toBe(200)
    expect(prisma.user.update).not.toHaveBeenCalled()
    expect(stripe.subscriptions.retrieve).not.toHaveBeenCalled()
    expect(stripeLogger.info).toHaveBeenCalledWith(
      { eventId: EVENT_ID, type: "checkout.session.completed" },
      "Duplicate Stripe event skipped"
    )
  })

  it("skips the duplicate even though getRedisClient() returns null", async () => {
    // Regression: with no Redis the old guard was a no-op and the second
    // delivery re-processed the payment.
    expect(getRedisClient()).toBeNull()

    mockProCheckoutEvent()
    ;(prisma.processedWebhookEvent.create as jest.Mock)
      .mockResolvedValueOnce({ id: "row-1" })
      .mockRejectedValueOnce(uniqueConstraintError())

    const first = await POST(createWebhookRequest())
    expect(first.status).toBe(200)
    expect(prisma.user.update).toHaveBeenCalledTimes(1)

    const second = await POST(createWebhookRequest())
    expect(second.status).toBe(200)
    expect(prisma.user.update).toHaveBeenCalledTimes(1)
  })

  it("skips a duplicate creator tip so the tip is not written twice", async () => {
    ;(stripe.webhooks.constructEvent as jest.Mock).mockReturnValue({
      id: "evt_tip_1",
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_tip_1",
          currency: "usd",
          payment_status: "paid",
          payment_intent: "pi_1",
          metadata: {
            flowType: "creator_tip",
            supporterId: "supporter-1",
            creatorId: "creator-1",
            amountCents: "500",
          },
        },
      },
    })
    ;(prisma.creatorTip.upsert as jest.Mock).mockResolvedValue({})
    ;(prisma.processedWebhookEvent.create as jest.Mock)
      .mockResolvedValueOnce({ id: "row-1" })
      .mockRejectedValueOnce(uniqueConstraintError())

    await POST(createWebhookRequest())
    await POST(createWebhookRequest())

    expect(prisma.creatorTip.upsert).toHaveBeenCalledTimes(1)
  })

  it("releases the claim when a handler throws so Stripe can retry", async () => {
    mockProCheckoutEvent()
    ;(prisma.processedWebhookEvent.create as jest.Mock).mockResolvedValue({ id: "row-1" })
    ;(prisma.processedWebhookEvent.deleteMany as jest.Mock).mockResolvedValue({ count: 1 })
    ;(prisma.user.update as jest.Mock).mockRejectedValue(new Error("db down"))

    await expect(POST(createWebhookRequest())).rejects.toThrow("db down")

    expect(prisma.processedWebhookEvent.deleteMany).toHaveBeenCalledWith({
      where: { provider: "stripe", eventId: EVENT_ID },
    })
  })

  it("does not run the handlers when the claim insert fails for a non-P2002 reason", async () => {
    mockProCheckoutEvent()
    ;(prisma.processedWebhookEvent.create as jest.Mock).mockRejectedValue(
      new Error("connection terminated")
    )

    await expect(POST(createWebhookRequest())).rejects.toThrow("connection terminated")
    expect(prisma.user.update).not.toHaveBeenCalled()
  })
})

export {}
