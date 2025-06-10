/**
 * @jest-environment node
 */

/**
 * API Route Tests: CSRF Token
 *
 * Tests GET /api/csrf
 */

import { NextRequest } from "next/server"

// ---- Imports (after mocks) ----

import { createCsrfCookie, generateCsrfToken } from "@/app/lib/csrf"
import { csrfLimiter } from "@/app/lib/rate-limit"
import { GET } from "@/app/api/csrf/route"

// ---- Mocks ----

jest.mock("@/app/lib/csrf", () => ({
  generateCsrfToken: jest.fn(() => "mock-csrf-token-abcdef1234567890"),
  createCsrfCookie: jest.fn(
    (token: string) => `csrf-token=${token}; HttpOnly; Path=/; Max-Age=86400; SameSite=strict`
  ),
}))

jest.mock("@/app/lib/rate-limit", () => ({
  csrfLimiter: { check: jest.fn(() => true) },
  getClientIdentifier: jest.fn(() => "127.0.0.1"),
}))

// ---- Helpers ----

function createGetRequest(): NextRequest {
  return new NextRequest("http://localhost:3000/api/csrf", {
    method: "GET",
    headers: {
      "x-forwarded-for": "127.0.0.1",
    },
  })
}

// ---- Tests ----

beforeEach(() => {
  jest.clearAllMocks()
  ;(generateCsrfToken as jest.Mock).mockReturnValue("mock-csrf-token-abcdef1234567890")
  ;(createCsrfCookie as jest.Mock).mockImplementation(
    (token: string) => `csrf-token=${token}; HttpOnly; Path=/; Max-Age=86400; SameSite=strict`
  )
  ;(csrfLimiter.check as jest.Mock).mockReturnValue(true)
})

describe("GET /api/csrf", () => {
  it("returns a 200 response", async () => {
    const request = createGetRequest()
    const response = await GET(request)

    expect(response.status).toBe(200)
  })

  it("returns a token in the JSON body", async () => {
    const request = createGetRequest()
    const response = await GET(request)

    const data = await response.json()
    expect(data.token).toBe("mock-csrf-token-abcdef1234567890")
  })

  it("includes a message field in the JSON body", async () => {
    const request = createGetRequest()
    const response = await GET(request)

    const data = await response.json()
    expect(data.message).toBeDefined()
    expect(typeof data.message).toBe("string")
    expect(data.message.length).toBeGreaterThan(0)
  })

  it("sets the Set-Cookie header in the response", async () => {
    const request = createGetRequest()
    const response = await GET(request)

    const setCookie = response.headers.get("Set-Cookie")
    expect(setCookie).toBeTruthy()
  })

  it("puts the generated token in the Set-Cookie header", async () => {
    const request = createGetRequest()
    const response = await GET(request)

    const setCookie = response.headers.get("Set-Cookie")
    expect(setCookie).toContain("mock-csrf-token-abcdef1234567890")
  })

  it("calls generateCsrfToken once per request", async () => {
    const request = createGetRequest()
    await GET(request)

    expect(generateCsrfToken).toHaveBeenCalledTimes(1)
  })

  it("calls createCsrfCookie with the generated token", async () => {
    const request = createGetRequest()
    await GET(request)

    expect(createCsrfCookie).toHaveBeenCalledWith("mock-csrf-token-abcdef1234567890")
  })

  it("returns a fresh token on each request", async () => {
    const firstToken = "token-first-aaa111"
    const secondToken = "token-second-bbb222"

    ;(generateCsrfToken as jest.Mock)
      .mockReturnValueOnce(firstToken)
      .mockReturnValueOnce(secondToken)

    const firstResponse = await GET(createGetRequest())
    const secondResponse = await GET(createGetRequest())

    const firstData = await firstResponse.json()
    const secondData = await secondResponse.json()

    expect(firstData.token).toBe(firstToken)
    expect(secondData.token).toBe(secondToken)
    expect(firstData.token).not.toBe(secondData.token)
  })

  it("response Content-Type is application/json", async () => {
    const request = createGetRequest()
    const response = await GET(request)

    const contentType = response.headers.get("Content-Type")
    expect(contentType).toContain("application/json")
  })

  it("returns 429 when rate limit is exceeded", async () => {
    ;(csrfLimiter.check as jest.Mock).mockReturnValue(false)

    const request = createGetRequest()
    const response = await GET(request)

    expect(response.status).toBe(429)
  })

  it("includes a Retry-After header when rate limited", async () => {
    ;(csrfLimiter.check as jest.Mock).mockReturnValue(false)

    const request = createGetRequest()
    const response = await GET(request)

    expect(response.headers.get("Retry-After")).toBeTruthy()
  })

  it("does not generate a token when rate limited", async () => {
    ;(csrfLimiter.check as jest.Mock).mockReturnValue(false)

    const request = createGetRequest()
    await GET(request)

    expect(generateCsrfToken).not.toHaveBeenCalled()
  })

  it("does not set a cookie when rate limited", async () => {
    ;(csrfLimiter.check as jest.Mock).mockReturnValue(false)

    const request = createGetRequest()
    const response = await GET(request)

    expect(createCsrfCookie).not.toHaveBeenCalled()
    expect(response.headers.get("Set-Cookie")).toBeNull()
  })
})

export {}
