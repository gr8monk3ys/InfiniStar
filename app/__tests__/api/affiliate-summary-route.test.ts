/**
 * @jest-environment node
 */

import { NextRequest } from "next/server"

const mockAuth = jest.fn()
const mockLimiterCheck = jest.fn()
const mockClientIdentifier = jest.fn((_request?: NextRequest) => "127.0.0.1")
const mockFindUser = jest.fn()
const mockCount = jest.fn()
const mockGroupBy = jest.fn()
const mockFindMany = jest.fn()

jest.mock("@clerk/nextjs/server", () => ({
  auth: () => mockAuth(),
}))

jest.mock("@/app/lib/rate-limit", () => ({
  apiLimiter: {
    check: (identifier: string) => mockLimiterCheck(identifier),
  },
  getClientIdentifier: (request: NextRequest) => mockClientIdentifier(request),
}))

jest.mock("@/app/lib/prismadb", () => ({
  __esModule: true,
  default: {
    user: {
      findUnique: (args: unknown) => mockFindUser(args),
    },
    affiliateClick: {
      count: (args: unknown) => mockCount(args),
      groupBy: (args: unknown) => mockGroupBy(args),
      findMany: (args: unknown) => mockFindMany(args),
    },
  },
}))

function createRequest(query: string = ""): NextRequest {
  const querySuffix = query ? `?${query}` : ""
  return new NextRequest(`http://localhost:3000/api/affiliate/summary${querySuffix}`, {
    method: "GET",
    headers: {
      "x-forwarded-for": "127.0.0.1",
    },
  })
}

describe("GET /api/affiliate/summary", () => {
  const originalEnv = process.env

  beforeEach(() => {
    jest.resetModules()
    jest.clearAllMocks()

    process.env = {
      ...originalEnv,
      NEXT_PUBLIC_AFFILIATE_ANTHROPIC_URL: "https://partner.example.com/anthropic",
      NEXT_PUBLIC_AFFILIATE_GRAMMARLY_URL: "https://partner.example.com/grammarly",
      AFFILIATE_ANALYTICS_ALLOWED_EMAILS: "owner@example.com",
    }

    mockLimiterCheck.mockResolvedValue(true)
    mockAuth.mockResolvedValue({ userId: "clerk_123" })
    mockFindUser.mockResolvedValue({ email: "owner@example.com" })
    mockCount.mockResolvedValue(5)
    mockGroupBy
      .mockResolvedValueOnce([
        { partnerId: "anthropic", _count: { _all: 3 } },
        { partnerId: "grammarly", _count: { _all: 2 } },
      ])
      .mockResolvedValueOnce([
        { source: "pricing", _count: { _all: 4 } },
        { source: "homepage", _count: { _all: 1 } },
      ])
      .mockResolvedValueOnce([{ destinationHost: "partner.example.com", _count: { _all: 5 } }])
    mockFindMany.mockResolvedValue([
      { createdAt: new Date("2026-02-12T12:00:00.000Z") },
      { createdAt: new Date("2026-02-12T18:30:00.000Z") },
      { createdAt: new Date("2026-02-11T08:15:00.000Z") },
    ])
  })

  afterAll(() => {
    process.env = originalEnv
  })

  async function runGet(query: string = "") {
    const { GET } = await import("@/app/api/affiliate/summary/route")
    return GET(createRequest(query))
  }

  it("returns 429 when rate limit is exceeded", async () => {
    mockLimiterCheck.mockResolvedValue(false)

    const response = await runGet()
    expect(response.status).toBe(429)
  })

  it("returns 401 when user is not authenticated", async () => {
    mockAuth.mockResolvedValue({ userId: null })

    const response = await runGet()
    expect(response.status).toBe(401)
  })

  it("returns 403 when allowlist is not configured", async () => {
    process.env.AFFILIATE_ANALYTICS_ALLOWED_EMAILS = ""

    const response = await runGet()
    expect(response.status).toBe(403)
  })

  it("returns 403 when user email is not allowlisted", async () => {
    mockFindUser.mockResolvedValue({ email: "viewer@example.com" })

    const response = await runGet()
    expect(response.status).toBe(403)
  })

  it("returns 400 for invalid query parameters", async () => {
    const response = await runGet("days=0")
    expect(response.status).toBe(400)
  })

  it("returns aggregated analytics for allowlisted users", async () => {
    const response = await runGet("days=14&source=Pricing+Page&limit=2")

    expect(response.status).toBe(200)
    const body = await response.json()

    expect(body.windowDays).toBe(14)
    expect(body.filters.source).toBe("pricing-page")
    expect(body.totals).toEqual(
      expect.objectContaining({
        clicks: 5,
        uniquePartners: 2,
        uniqueSources: 2,
      })
    )
    expect(body.byPartner).toEqual([
      { partnerId: "anthropic", partnerName: "Claude Pro", clicks: 3 },
      { partnerId: "grammarly", partnerName: "Grammarly", clicks: 2 },
    ])
    expect(body.bySource).toEqual([
      { source: "pricing", clicks: 4 },
      { source: "homepage", clicks: 1 },
    ])
    expect(body.dailyClicks).toEqual([
      { date: "2026-02-11", clicks: 1 },
      { date: "2026-02-12", clicks: 2 },
    ])
    expect(mockGroupBy).toHaveBeenCalledTimes(3)
    expect(mockFindMany).toHaveBeenCalled()
  })
})

export {}
