/**
 * @jest-environment node
 */

import { NextRequest } from "next/server"

const mockGetAuthSession = jest.fn()
const mockUserFindUnique = jest.fn()
const mockRateLimitCheck = jest.fn()

jest.mock("@/app/lib/auth", () => ({
  getAuthSession: (...args: unknown[]) => mockGetAuthSession(...args),
}))

jest.mock("@/app/lib/prismadb", () => ({
  __esModule: true,
  default: {
    user: {
      findUnique: (...args: unknown[]) => mockUserFindUnique(...args),
    },
  },
}))

jest.mock("@/app/lib/rate-limit", () => ({
  apiLimiter: { check: (...args: unknown[]) => mockRateLimitCheck(...args) },
  getClientIdentifier: () => "127.0.0.1",
}))

const sessionUser = {
  id: "11111111-1111-4111-8111-111111111111",
  clerkId: "user_1",
  email: "a@example.com",
  name: "A",
  image: null,
}

function makeRequest() {
  return new NextRequest("http://localhost:3000/api/auth/session")
}

// The prerendered pages (character, creator, pricing) render the gated,
// free-plan version for everyone and unlock from this payload. These tests pin
// what it says, and that it never says more than the user row supports.
describe("GET /api/auth/session viewer facts", () => {
  let GET: (request: NextRequest) => Promise<Response>

  beforeAll(async () => {
    GET = (await import("@/app/api/auth/session/route")).GET
  })

  beforeEach(() => {
    jest.clearAllMocks()
    mockRateLimitCheck.mockResolvedValue(true)
  })

  it("reports a signed-out viewer with both flags false and no user lookup", async () => {
    mockGetAuthSession.mockResolvedValue(null)

    const response = await GET(makeRequest())
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toEqual({
      authMode: null,
      isSignedIn: false,
      user: null,
      viewer: { canViewMature: false, isPro: false },
    })
    expect(mockUserFindUnique).not.toHaveBeenCalled()
    expect(response.headers.get("Cache-Control")).toBe("private, no-store")
  })

  it("confirms mature access only when adult, opted in, and confirmed", async () => {
    mockGetAuthSession.mockResolvedValue({ authMode: "clerk", user: sessionUser })
    mockUserFindUnique.mockResolvedValue({
      isAdult: true,
      nsfwEnabled: true,
      adultConfirmedAt: new Date("2026-01-01"),
      stripePriceId: null,
      stripeCurrentPeriodEnd: null,
    })

    const body = await (await GET(makeRequest())).json()

    expect(body.isSignedIn).toBe(true)
    expect(body.viewer).toEqual({ canViewMature: true, isPro: false })
    expect(mockUserFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: sessionUser.id } })
    )
  })

  it("keeps mature access false for an adult who has not opted in", async () => {
    mockGetAuthSession.mockResolvedValue({ authMode: "clerk", user: sessionUser })
    mockUserFindUnique.mockResolvedValue({
      isAdult: true,
      nsfwEnabled: false,
      adultConfirmedAt: new Date("2026-01-01"),
      stripePriceId: null,
      stripeCurrentPeriodEnd: null,
    })

    const body = await (await GET(makeRequest())).json()

    expect(body.viewer.canViewMature).toBe(false)
  })

  it("reports PRO from an active subscription, including the grace period", async () => {
    mockGetAuthSession.mockResolvedValue({ authMode: "clerk", user: sessionUser })
    mockUserFindUnique.mockResolvedValue({
      isAdult: false,
      nsfwEnabled: false,
      adultConfirmedAt: null,
      stripePriceId: "price_pro",
      // Ended an hour ago: inside the 24h grace period, still PRO.
      stripeCurrentPeriodEnd: new Date(Date.now() - 60 * 60 * 1000),
    })

    const body = await (await GET(makeRequest())).json()

    expect(body.viewer).toEqual({ canViewMature: false, isPro: true })
  })

  it("falls back to both flags false when the user row is missing or the lookup fails", async () => {
    mockGetAuthSession.mockResolvedValue({ authMode: "clerk", user: sessionUser })

    mockUserFindUnique.mockResolvedValueOnce(null)
    expect((await (await GET(makeRequest())).json()).viewer).toEqual({
      canViewMature: false,
      isPro: false,
    })

    mockUserFindUnique.mockRejectedValueOnce(new Error("db down"))
    const body = await (await GET(makeRequest())).json()
    expect(body.isSignedIn).toBe(true)
    expect(body.viewer).toEqual({ canViewMature: false, isPro: false })
  })

  it("rate limits", async () => {
    mockRateLimitCheck.mockResolvedValue(false)
    const response = await GET(makeRequest())
    expect(response.status).toBe(429)
    expect(mockGetAuthSession).not.toHaveBeenCalled()
  })
})
