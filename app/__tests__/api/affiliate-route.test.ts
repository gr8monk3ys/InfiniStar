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
  __esModule: true,
  default: {
    child: jest.fn().mockReturnValue({ warn: jest.fn(), info: jest.fn(), error: jest.fn() }),
  },
  apiLogger: {
    warn: jest.fn(),
    info: (payload: unknown, message: string) => mockInfo(payload, message),
    error: (payload: unknown, message: string) => mockError(payload, message),
  },
  authLogger: { warn: jest.fn(), info: jest.fn(), error: jest.fn() },
  aiLogger: { warn: jest.fn(), info: jest.fn(), error: jest.fn() },
  stripeLogger: { warn: jest.fn(), info: jest.fn(), error: jest.fn() },
  dbLogger: { warn: jest.fn(), info: jest.fn(), error: jest.fn() },
}))

jest.mock("@/app/lib/prismadb", () => ({
  __esModule: true,
  default: {
    affiliateClick: {
      create: (args: unknown) => mockCreateAffiliateClick(args),
    },
  },
}))

// Explicitly mock monetization so this test file's behavior is not affected by
// other test files that mock @/app/lib/monetization in the shared Bun module registry.
// The mock re-implements the minimal behavior needed, reading env vars lazily.
jest.mock("@/app/lib/monetization", () => {
  const isEnabled = (v: string | undefined) => {
    if (!v) return false
    const n = v.trim().toLowerCase()
    return n === "1" || n === "true" || n === "yes" || n === "on"
  }

  const normalizeSource = (src: string | null | undefined): string => {
    if (!src) return "unknown"
    const n = src
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, "-")
      .replace(/^-+|-+$/g, "")
    return n.length > 0 ? n : "unknown"
  }

  const PARTNER_NAMES: Record<string, { name: string; description: string; ctaLabel: string }> = {
    anthropic: { name: "Claude Pro", description: "", ctaLabel: "View Claude Pro" },
    notion: { name: "Notion AI", description: "", ctaLabel: "View Notion AI" },
    grammarly: { name: "Grammarly", description: "", ctaLabel: "View Grammarly" },
  }

  return {
    monetizationConfig: {
      get enableAffiliateLinks() {
        return isEnabled(process.env.NEXT_PUBLIC_ENABLE_AFFILIATE_LINKS)
      },
    },
    getAffiliatePartner: (partnerId: string) => {
      const envKey = `NEXT_PUBLIC_AFFILIATE_${partnerId.toUpperCase()}_URL`
      const url = process.env[envKey]
      if (!url || !url.trim()) return null
      const meta = PARTNER_NAMES[partnerId] ?? { name: partnerId, description: "", ctaLabel: "" }
      return { id: partnerId, url: url.trim(), ...meta }
    },
    normalizeAffiliateSource: normalizeSource,
    buildAffiliateUrl: (url: string, sourcePage: string, partnerId: string) => {
      try {
        const parsed = new URL(url)
        const campaign = normalizeSource(sourcePage)
        if (!parsed.searchParams.has("utm_source"))
          parsed.searchParams.set("utm_source", "infinistar")
        if (!parsed.searchParams.has("utm_medium"))
          parsed.searchParams.set("utm_medium", "affiliate")
        if (!parsed.searchParams.has("utm_campaign"))
          parsed.searchParams.set("utm_campaign", campaign)
        if (!parsed.searchParams.has("utm_content"))
          parsed.searchParams.set("utm_content", partnerId)
        return parsed.toString()
      } catch {
        return url
      }
    },
  }
})

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
  // Saved env values for cleanup — uses direct property mutation to reliably affect global process.env
  const savedEnv: Record<string, string | undefined> = {}
  const managedKeys = [
    "NEXT_PUBLIC_ENABLE_AFFILIATE_LINKS",
    "NEXT_PUBLIC_AFFILIATE_ANTHROPIC_URL",
    "NEXT_PUBLIC_AFFILIATE_NOTION_URL",
    "NEXT_PUBLIC_AFFILIATE_GRAMMARLY_URL",
  ]

  beforeEach(() => {
    jest.clearAllMocks()
    // Save originals and set test defaults via direct mutation (process.env = {} replacement is unreliable in Bun)
    for (const key of managedKeys) {
      savedEnv[key] = process.env[key]
    }
    process.env.NEXT_PUBLIC_ENABLE_AFFILIATE_LINKS = "true"
    process.env.NEXT_PUBLIC_AFFILIATE_ANTHROPIC_URL = "https://partner.example.com/tool"
    delete process.env.NEXT_PUBLIC_AFFILIATE_NOTION_URL
    delete process.env.NEXT_PUBLIC_AFFILIATE_GRAMMARLY_URL

    mockLimiterCheck.mockResolvedValue(true)
    mockClientIdentifier.mockReturnValue("127.0.0.1")
    mockCreateAffiliateClick.mockResolvedValue({ id: "click_1" })
  })

  afterEach(() => {
    // Restore env vars to avoid leaking into other tests
    for (const key of managedKeys) {
      if (savedEnv[key] === undefined) {
        delete process.env[key]
      } else {
        process.env[key] = savedEnv[key]
      }
    }
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
