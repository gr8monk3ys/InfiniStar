/**
 * @jest-environment node
 */

/**
 * API Route Tests: Stripe Checkout (extended coverage)
 *
 * Tests POST /api/stripe/checkout with focus on:
 * - Stripe customer lifecycle (create vs reuse)
 * - Metadata passed to Stripe
 * - Edge cases not covered in stripe-checkout-route.test.ts
 */

import { NextRequest } from "next/server"
import { auth } from "@clerk/nextjs/server"

import { verifyCsrfToken } from "@/app/lib/csrf"
import prisma from "@/app/lib/prismadb"
import { apiLimiter, getClientIdentifier } from "@/app/lib/rate-limit"
import { stripe } from "@/app/lib/stripe"
// ---- Imports (after mocks) ----

import { POST } from "@/app/api/stripe/checkout/route"

// ---- Mocks ----

jest.mock("@/env.mjs", () => ({
  env: {
    STRIPE_PRO_MONTHLY_PLAN_ID: "price_test_pro_monthly",
    NEXT_PUBLIC_APP_URL: "http://localhost:3000",
  },
}))

jest.mock("@clerk/nextjs/server", () => ({
  auth: jest.fn(),
}))

jest.mock("@/app/lib/csrf", () => ({
  verifyCsrfToken: jest.fn(() => true),
  getCsrfTokenFromRequest: jest.fn(() => "test-csrf-token"),
}))

jest.mock("@/app/lib/rate-limit", () => ({
  apiLimiter: { check: jest.fn(() => true) },
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
      retrieve: jest.fn(),
      create: jest.fn(),
    },
    checkout: {
      sessions: {
        create: jest.fn(),
      },
    },
  },
}))

// ---- Helpers ----

function createRequest(headers: Record<string, string> = {}): NextRequest {
  return new NextRequest("http://localhost:3000/api/stripe/checkout", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-CSRF-Token": "test-csrf-token",
      cookie: "csrf-token=test-csrf-token",
      "x-forwarded-for": "127.0.0.1",
      ...headers,
    },
    body: JSON.stringify({}),
  })
}

const baseUser = {
  id: "user-db-1",
  email: "user@example.com",
  name: "Test User",
  stripeCustomerId: null,
  stripeSubscriptionId: null,
}

// ---- Tests ----

beforeEach(() => {
  jest.clearAllMocks()
  ;(auth as unknown as jest.Mock).mockResolvedValue({ userId: "clerk_abc" })
  ;(verifyCsrfToken as jest.Mock).mockReturnValue(true)
  ;(apiLimiter.check as jest.Mock).mockReturnValue(true)
  ;(getClientIdentifier as jest.Mock).mockReturnValue("127.0.0.1")
  ;(prisma.user.findUnique as jest.Mock).mockResolvedValue(baseUser)
  ;(stripe.customers.retrieve as jest.Mock).mockResolvedValue({
    id: "cus_preexisting",
    deleted: false,
  })
  ;(stripe.customers.create as jest.Mock).mockResolvedValue({ id: "cus_newly_created" })
  ;(stripe.checkout.sessions.create as jest.Mock).mockResolvedValue({
    url: "https://checkout.stripe.com/session_abc",
  })
  ;(prisma.user.update as jest.Mock).mockResolvedValue({})
})

describe("POST /api/stripe/checkout", () => {
  describe("Guard clauses", () => {
    it("returns 429 when rate limit is exceeded", async () => {
      ;(apiLimiter.check as jest.Mock).mockReturnValue(false)

      const response = await POST(createRequest())
      expect(response.status).toBe(429)
    })

    it("returns 403 when CSRF token is invalid", async () => {
      ;(verifyCsrfToken as jest.Mock).mockReturnValue(false)

      const response = await POST(createRequest())
      expect(response.status).toBe(403)
    })

    it("returns 401 when user is not authenticated", async () => {
      ;(auth as unknown as jest.Mock).mockResolvedValue({ userId: null })

      const response = await POST(createRequest())
      expect(response.status).toBe(401)
    })

    it("returns 404 when user record does not exist in the database", async () => {
      ;(prisma.user.findUnique as jest.Mock).mockResolvedValue(null)

      const response = await POST(createRequest())
      expect(response.status).toBe(404)
    })

    it("returns 400 when user already has an active subscription", async () => {
      ;(prisma.user.findUnique as jest.Mock).mockResolvedValue({
        ...baseUser,
        stripeCustomerId: "cus_existing",
        stripeSubscriptionId: "sub_existing_active",
      })

      const response = await POST(createRequest())
      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data.error).toContain("already has an active subscription")
    })
  })

  describe("Stripe customer creation", () => {
    it("creates a new Stripe customer when none exists", async () => {
      const response = await POST(createRequest())
      expect(response.status).toBe(200)

      expect(stripe.customers.create).toHaveBeenCalledTimes(1)
      expect(stripe.customers.create).toHaveBeenCalledWith({
        email: "user@example.com",
        name: "Test User",
        metadata: { userId: "user-db-1" },
      })
    })

    it("persists the new customer ID to the database", async () => {
      await POST(createRequest())

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: "user-db-1" },
        data: { stripeCustomerId: "cus_newly_created", stripeSubscriptionId: null },
      })
    })

    it("does not create a new customer when one already exists", async () => {
      ;(prisma.user.findUnique as jest.Mock).mockResolvedValue({
        ...baseUser,
        stripeCustomerId: "cus_preexisting",
      })
      ;(stripe.customers.retrieve as jest.Mock).mockResolvedValue({
        id: "cus_preexisting",
        deleted: false,
      })

      await POST(createRequest())

      expect(stripe.customers.create).not.toHaveBeenCalled()
      expect(prisma.user.update).not.toHaveBeenCalled()
    })

    it("uses the existing customer ID when creating the checkout session", async () => {
      ;(prisma.user.findUnique as jest.Mock).mockResolvedValue({
        ...baseUser,
        stripeCustomerId: "cus_preexisting",
      })

      await POST(createRequest())

      expect(stripe.checkout.sessions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          customer: "cus_preexisting",
        })
      )
    })
  })

  describe("Checkout session creation", () => {
    it("creates checkout session with subscription mode", async () => {
      await POST(createRequest())

      expect(stripe.checkout.sessions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          mode: "subscription",
        })
      )
    })

    it("creates checkout session with the configured price plan", async () => {
      await POST(createRequest())

      expect(stripe.checkout.sessions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          line_items: [{ price: "price_test_pro_monthly", quantity: 1 }],
        })
      )
    })

    it("sets the success URL to the dashboard with upgraded=true param", async () => {
      await POST(createRequest())

      expect(stripe.checkout.sessions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          success_url: "http://localhost:3000/dashboard?upgraded=true",
        })
      )
    })

    it("sets the cancel URL to the pricing page", async () => {
      await POST(createRequest())

      expect(stripe.checkout.sessions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          cancel_url: "http://localhost:3000/pricing",
        })
      )
    })

    it("attaches user ID metadata to the checkout session", async () => {
      await POST(createRequest())

      expect(stripe.checkout.sessions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: { userId: "user-db-1" },
        })
      )
    })

    it("returns the checkout session URL on success", async () => {
      const response = await POST(createRequest())
      expect(response.status).toBe(200)

      const data = await response.json()
      expect(data.url).toBe("https://checkout.stripe.com/session_abc")
    })
  })

  describe("Error handling", () => {
    it("returns 500 when Stripe customer creation fails", async () => {
      ;(stripe.customers.create as jest.Mock).mockRejectedValue(
        new Error("Stripe: Card network unavailable")
      )

      const response = await POST(createRequest())
      expect(response.status).toBe(500)
    })

    it("returns 500 when Stripe checkout session creation fails", async () => {
      ;(stripe.checkout.sessions.create as jest.Mock).mockRejectedValue(
        new Error("Stripe: Session creation failed")
      )

      const response = await POST(createRequest())
      expect(response.status).toBe(500)
    })

    it("returns 500 when the database update for customer ID fails", async () => {
      ;(prisma.user.update as jest.Mock).mockRejectedValue(new Error("DB write error"))

      const response = await POST(createRequest())
      expect(response.status).toBe(500)
    })

    it("returns 500 when the database lookup fails", async () => {
      ;(prisma.user.findUnique as jest.Mock).mockRejectedValue(new Error("DB read error"))

      const response = await POST(createRequest())
      expect(response.status).toBe(500)
    })
  })

  describe("User lookup", () => {
    it("looks up the user by Clerk userId", async () => {
      await POST(createRequest())

      expect(prisma.user.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { clerkId: "clerk_abc" },
        })
      )
    })

    it("selects subscription-related fields from the user record", async () => {
      await POST(createRequest())

      expect(prisma.user.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          select: expect.objectContaining({
            id: true,
            email: true,
            stripeCustomerId: true,
            stripeSubscriptionId: true,
          }),
        })
      )
    })
  })
})

export {}
