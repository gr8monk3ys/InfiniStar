/**
 * @jest-environment node
 */

import { NextRequest } from "next/server"

const mockLimiterCheck = jest.fn()
const mockClientIdentifier = jest.fn((_request?: NextRequest) => "127.0.0.1")
const mockInfo = jest.fn()
const mockError = jest.fn()
const mockCreateAffiliateClick = jest.fn()

jest.mock("@/app/lib/rate-limit", () => ({
  apiLimiter: {
    check: (identifier: string) => mockLimiterCheck(identifier),
  },
  getClientIdentifier: (request: NextRequest) => mockClientIdentifier(request),
}))

jest.mock("@/app/lib/logger", () => ({
  apiLogger: {
    info: (payload: unknown, message: string) => mockInfo(payload, message),
    error: (payload: unknown, message: string) => mockError(payload, message),
  },
}))

jest.mock("@/app/lib/prismadb", () => ({
  __esModule: true,
  default: {
    affiliateClick: {
      create: (args: unknown) => mockCreateAffiliateClick(args),
    },
  },
}))

function createRequest(source: string): NextRequest {
  return new NextRequest(`http://localhost:3000/api/affiliate/anthropic?source=${source}`, {
    method: "GET",
    headers: {
      "x-forwarded-for": "127.0.0.1",
      "user-agent": "jest-test-agent",
      referer: "http://localhost:3000/pricing",
    },
  })
}

describe("GET /api/affiliate/[partnerId]", () => {
  const originalEnv = process.env

  beforeEach(() => {
    jest.resetModules()
    jest.clearAllMocks()
    process.env = {
      ...originalEnv,
      NEXT_PUBLIC_ENABLE_AFFILIATE_LINKS: "true",
      NEXT_PUBLIC_AFFILIATE_ANTHROPIC_URL: "https://partner.example.com/tool",
      NEXT_PUBLIC_AFFILIATE_NOTION_URL: "",
      NEXT_PUBLIC_AFFILIATE_GRAMMARLY_URL: "",
    }

    mockLimiterCheck.mockResolvedValue(true)
    mockClientIdentifier.mockReturnValue("127.0.0.1")
    mockCreateAffiliateClick.mockResolvedValue({ id: "click_1" })
  })

  afterAll(() => {
    process.env = originalEnv
  })

  async function runGet(source: string, partnerId: string = "anthropic") {
    const { GET } = await import("@/app/api/affiliate/[partnerId]/route")
    return GET(createRequest(source), { params: Promise.resolve({ partnerId }) })
  }

  it("returns 429 when rate limit is exceeded", async () => {
    mockLimiterCheck.mockResolvedValue(false)

    const response = await runGet("pricing")
    expect(response.status).toBe(429)
  })

  it("returns 404 when affiliate links are disabled", async () => {
    process.env.NEXT_PUBLIC_ENABLE_AFFILIATE_LINKS = "false"

    const response = await runGet("pricing")
    expect(response.status).toBe(404)
  })

  it("returns 404 for unknown affiliate partners", async () => {
    const response = await runGet("pricing", "missing-partner")
    expect(response.status).toBe(404)
  })

  it("redirects to partner URL with UTM params and logs click metadata", async () => {
    const response = await runGet("Pricing Page")

    expect(response.status).toBe(302)
    expect(response.headers.get("cache-control")).toBe("no-store")
    expect(response.headers.get("location")).toBe(
      "https://partner.example.com/tool?utm_source=infinistar&utm_medium=affiliate&utm_campaign=pricing-page&utm_content=anthropic"
    )

    expect(mockInfo).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "affiliate_click",
        partnerId: "anthropic",
        source: "pricing-page",
        clientId: "127.0.0.1",
      }),
      "Affiliate link click"
    )
    expect(mockCreateAffiliateClick).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          partnerId: "anthropic",
          source: "pricing-page",
          destinationHost: "partner.example.com",
          clientIp: "127.0.0.1",
        }),
      })
    )
  })

  it("returns 500 when destination URL is invalid", async () => {
    process.env.NEXT_PUBLIC_AFFILIATE_ANTHROPIC_URL = "not-a-valid-url"

    const response = await runGet("pricing")
    expect(response.status).toBe(500)
    expect(mockError).toHaveBeenCalled()
    expect(mockCreateAffiliateClick).not.toHaveBeenCalled()
  })

  it("still redirects when click persistence fails", async () => {
    mockCreateAffiliateClick.mockRejectedValueOnce(new Error("database unavailable"))

    const response = await runGet("pricing")

    expect(response.status).toBe(302)
    expect(response.headers.get("location")).toContain("partner.example.com/tool")
    expect(mockError).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "affiliate_click_persist_failed",
        partnerId: "anthropic",
      }),
      "Failed to persist affiliate click analytics"
    )
  })
})

export {}
