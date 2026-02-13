/**
 * @jest-environment node
 */

import { NextRequest } from "next/server"
import { auth } from "@clerk/nextjs/server"

import { verifyCsrfToken } from "@/app/lib/csrf"
import prisma from "@/app/lib/prismadb"
import { apiLimiter, getClientIdentifier } from "@/app/lib/rate-limit"
import { stripe } from "@/app/lib/stripe"
import { POST } from "@/app/api/stripe/portal/route"

jest.mock("@/env.mjs", () => ({
  env: {
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
    },
  },
}))

jest.mock("@/app/lib/stripe", () => ({
  stripe: {
    billingPortal: {
      sessions: {
        create: jest.fn(),
      },
    },
  },
}))

function createRequest(): NextRequest {
  return new NextRequest("http://localhost:3000/api/stripe/portal", {
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

describe("POST /api/stripe/portal", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(apiLimiter.check as jest.Mock).mockReturnValue(true)
    ;(getClientIdentifier as jest.Mock).mockReturnValue("127.0.0.1")
    ;(verifyCsrfToken as jest.Mock).mockReturnValue(true)
    ;(auth as unknown as jest.Mock).mockResolvedValue({ userId: "clerk_123" })
    ;(prisma.user.findUnique as jest.Mock).mockResolvedValue({
      stripeCustomerId: "cus_123",
    })
    ;(stripe.billingPortal.sessions.create as jest.Mock).mockResolvedValue({
      url: "https://billing.stripe.test/session_123",
    })
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

  it("returns 400 when user has no billing account", async () => {
    ;(prisma.user.findUnique as jest.Mock).mockResolvedValue({
      stripeCustomerId: null,
    })

    const response = await POST(createRequest())
    expect(response.status).toBe(400)
  })

  it("creates portal session for valid customer", async () => {
    const response = await POST(createRequest())
    expect(response.status).toBe(200)

    const body = await response.json()
    expect(body.url).toBe("https://billing.stripe.test/session_123")
    expect(stripe.billingPortal.sessions.create).toHaveBeenCalledWith({
      customer: "cus_123",
      return_url: "http://localhost:3000/dashboard",
    })
  })

  it("returns 500 when Stripe portal creation throws", async () => {
    ;(stripe.billingPortal.sessions.create as jest.Mock).mockRejectedValue(
      new Error("Portal failure")
    )

    const response = await POST(createRequest())
    expect(response.status).toBe(500)
  })
})

export {}
