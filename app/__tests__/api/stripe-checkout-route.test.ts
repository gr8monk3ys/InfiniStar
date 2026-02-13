/**
 * @jest-environment node
 */

import { NextRequest } from "next/server"
import { auth } from "@clerk/nextjs/server"

import { verifyCsrfToken } from "@/app/lib/csrf"
import prisma from "@/app/lib/prismadb"
import { apiLimiter, getClientIdentifier } from "@/app/lib/rate-limit"
import { stripe } from "@/app/lib/stripe"
import { POST } from "@/app/api/stripe/checkout/route"

jest.mock("@/env.mjs", () => ({
  env: {
    STRIPE_PRO_MONTHLY_PLAN_ID: "price_pro_test",
    NEXT_PUBLIC_APP_URL: "http://localhost:3000",
  },
}))

jest.mock("@clerk/nextjs/server", () => ({
  auth: jest.fn(),
}))

jest.mock("@/app/lib/csrf", () => ({
  verifyCsrfToken: jest.fn(() => true),
}))

jest.mock("@/app/lib/rate-limit", () => ({
  apiLimiter: {
    check: jest.fn(() => true),
  },
  getClientIdentifier: jest.fn(() => "127.0.0.1"),
}))

jest.mock("@/app/lib/prismadb", () => ({
  __esModule: true,
  default: {
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  },
}))

jest.mock("@/app/lib/stripe", () => ({
  stripe: {
    customers: {
      create: jest.fn(),
    },
    checkout: {
      sessions: {
        create: jest.fn(),
      },
    },
  },
}))

function createRequest(): NextRequest {
  return new NextRequest("http://localhost:3000/api/stripe/checkout", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-CSRF-Token": "csrf-token",
      cookie: "csrf-token=csrf-token",
      "x-forwarded-for": "127.0.0.1",
    },
    body: JSON.stringify({}),
  })
}

describe("POST /api/stripe/checkout", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(apiLimiter.check as jest.Mock).mockReturnValue(true)
    ;(getClientIdentifier as jest.Mock).mockReturnValue("127.0.0.1")
    ;(verifyCsrfToken as jest.Mock).mockReturnValue(true)
    ;(auth as unknown as jest.Mock).mockResolvedValue({ userId: "clerk_123" })
    ;(prisma.user.findUnique as jest.Mock).mockResolvedValue({
      id: "user_1",
      email: "test@example.com",
      name: "Test User",
      stripeCustomerId: null,
      stripeSubscriptionId: null,
    })
    ;(stripe.customers.create as jest.Mock).mockResolvedValue({ id: "cus_new" })
    ;(stripe.checkout.sessions.create as jest.Mock).mockResolvedValue({
      url: "https://checkout.stripe.test/session_123",
    })
    ;(prisma.user.update as jest.Mock).mockResolvedValue({})
  })

  it("returns 429 when rate limit is exceeded", async () => {
    ;(apiLimiter.check as jest.Mock).mockReturnValue(false)

    const response = await POST(createRequest())
    expect(response.status).toBe(429)
  })

  it("returns 403 for invalid CSRF token", async () => {
    ;(verifyCsrfToken as jest.Mock).mockReturnValue(false)

    const response = await POST(createRequest())
    expect(response.status).toBe(403)
  })

  it("returns 401 when not authenticated", async () => {
    ;(auth as unknown as jest.Mock).mockResolvedValue({ userId: null })

    const response = await POST(createRequest())
    expect(response.status).toBe(401)
  })

  it("returns 404 when user does not exist", async () => {
    ;(prisma.user.findUnique as jest.Mock).mockResolvedValue(null)

    const response = await POST(createRequest())
    expect(response.status).toBe(404)
  })

  it("returns 400 when user already has an active subscription", async () => {
    ;(prisma.user.findUnique as jest.Mock).mockResolvedValue({
      id: "user_1",
      email: "test@example.com",
      name: "Test User",
      stripeCustomerId: "cus_existing",
      stripeSubscriptionId: "sub_existing",
    })

    const response = await POST(createRequest())
    expect(response.status).toBe(400)
  })

  it("creates customer and checkout session when customer does not exist", async () => {
    const response = await POST(createRequest())
    expect(response.status).toBe(200)

    const body = await response.json()
    expect(body.url).toBe("https://checkout.stripe.test/session_123")

    expect(stripe.customers.create).toHaveBeenCalledWith({
      email: "test@example.com",
      name: "Test User",
      metadata: { userId: "user_1" },
    })

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: "user_1" },
      data: { stripeCustomerId: "cus_new" },
    })

    expect(stripe.checkout.sessions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        customer: "cus_new",
        mode: "subscription",
        line_items: [{ price: "price_pro_test", quantity: 1 }],
        success_url: "http://localhost:3000/dashboard?upgraded=true",
        cancel_url: "http://localhost:3000/pricing",
      })
    )
  })

  it("reuses existing customer ID when present", async () => {
    ;(prisma.user.findUnique as jest.Mock).mockResolvedValue({
      id: "user_1",
      email: "test@example.com",
      name: "Test User",
      stripeCustomerId: "cus_existing",
      stripeSubscriptionId: null,
    })

    const response = await POST(createRequest())
    expect(response.status).toBe(200)

    expect(stripe.customers.create).not.toHaveBeenCalled()
    expect(prisma.user.update).not.toHaveBeenCalled()
    expect(stripe.checkout.sessions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        customer: "cus_existing",
      })
    )
  })

  it("returns 500 when Stripe session creation throws", async () => {
    ;(stripe.checkout.sessions.create as jest.Mock).mockRejectedValue(new Error("Stripe failure"))

    const response = await POST(createRequest())
    expect(response.status).toBe(500)
  })
})

export {}
