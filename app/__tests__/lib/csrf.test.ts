/**
 * @jest-environment node
 *
 * CSRF Utility Tests
 *
 * Tests the actual `app/lib/csrf` module exports directly (no mocking of the
 * module under test). This closes a coverage gap: the only other test that
 * touches this file (`app/__tests__/api/csrf.test.ts`) mocks the entire
 * module away, so the real Double Submit Cookie logic — timing-safe token
 * comparison, cookie parsing, cookie serialization, and the CSRF HOF — was
 * never exercised anywhere.
 */

import { headers } from "next/headers"

import {
  createCsrfCookie,
  CSRF_HEADER_NAME,
  generateCsrfToken,
  getCsrfTokenFromCookies,
  getCsrfTokenFromRequest,
  verifyCsrfToken,
  withCsrfProtection,
} from "@/app/lib/csrf"

jest.mock("next/headers", () => ({
  headers: jest.fn(),
}))

describe("generateCsrfToken", () => {
  it("returns a 64-character hex string (32 bytes)", () => {
    const token = generateCsrfToken()

    expect(token).toMatch(/^[0-9a-f]{64}$/)
  })

  it("returns a different token on each call", () => {
    const first = generateCsrfToken()
    const second = generateCsrfToken()

    expect(first).not.toBe(second)
  })
})

describe("verifyCsrfToken", () => {
  it("returns true when header and cookie tokens match", () => {
    const token = generateCsrfToken()

    expect(verifyCsrfToken(token, token)).toBe(true)
  })

  it("returns false when tokens differ", () => {
    expect(verifyCsrfToken(generateCsrfToken(), generateCsrfToken())).toBe(false)
  })

  it("returns false when header token is null", () => {
    expect(verifyCsrfToken(null, generateCsrfToken())).toBe(false)
  })

  it("returns false when cookie token is null", () => {
    expect(verifyCsrfToken(generateCsrfToken(), null)).toBe(false)
  })

  it("returns false when both tokens are null", () => {
    expect(verifyCsrfToken(null, null)).toBe(false)
  })

  it("returns false when tokens have different lengths", () => {
    expect(verifyCsrfToken("short", "a-much-longer-token-value")).toBe(false)
  })

  it("returns false for empty string tokens", () => {
    expect(verifyCsrfToken("", "")).toBe(false)
  })

  it("is case sensitive", () => {
    const token = generateCsrfToken()
    const upper = token.toUpperCase()

    // Same length, different case -> should not match unless identical
    expect(verifyCsrfToken(token, upper)).toBe(token === upper)
  })
})

describe("getCsrfTokenFromRequest", () => {
  function makeRequest(cookieHeader?: string): Request {
    return new Request("http://localhost:3000/api/test", {
      headers: cookieHeader ? { cookie: cookieHeader } : {},
    })
  }

  it("extracts the csrf-token value from a single cookie", () => {
    const request = makeRequest("csrf-token=abc123")

    expect(getCsrfTokenFromRequest(request)).toBe("abc123")
  })

  it("extracts csrf-token from a cookie header with multiple cookies", () => {
    const request = makeRequest("session=xyz; csrf-token=abc123; theme=dark")

    expect(getCsrfTokenFromRequest(request)).toBe("abc123")
  })

  it("returns null when there is no cookie header at all", () => {
    const request = makeRequest()

    expect(getCsrfTokenFromRequest(request)).toBeNull()
  })

  it("returns null when the cookie header has no csrf-token", () => {
    const request = makeRequest("session=xyz; theme=dark")

    expect(getCsrfTokenFromRequest(request)).toBeNull()
  })

  it("handles cookie values with surrounding whitespace", () => {
    const request = makeRequest("  session=xyz ;  csrf-token=abc123  ")

    expect(getCsrfTokenFromRequest(request)).toBe("abc123")
  })
})

describe("getCsrfTokenFromCookies", () => {
  afterEach(() => {
    jest.clearAllMocks()
  })

  it("returns the csrf-token value from the Next.js headers() cookie header", async () => {
    ;(headers as jest.Mock).mockResolvedValue({
      get: (name: string) => (name === "cookie" ? "csrf-token=serverside123" : null),
    })

    await expect(getCsrfTokenFromCookies()).resolves.toBe("serverside123")
  })

  it("returns null when there is no cookie header", async () => {
    ;(headers as jest.Mock).mockResolvedValue({
      get: () => null,
    })

    await expect(getCsrfTokenFromCookies()).resolves.toBeNull()
  })
})

describe("createCsrfCookie", () => {
  it("includes the token, Path, Max-Age, and SameSite by default", () => {
    const cookie = createCsrfCookie("mytoken")

    expect(cookie).toContain("csrf-token=mytoken")
    expect(cookie).toContain("Path=/")
    expect(cookie).toContain("Max-Age=86400")
    expect(cookie).toContain("SameSite=strict")
  })

  it("never sets HttpOnly (client JS must read it to echo the header)", () => {
    const cookie = createCsrfCookie("mytoken")

    expect(cookie).not.toContain("HttpOnly")
  })

  it("omits Secure by default outside of production", () => {
    const cookie = createCsrfCookie("mytoken")

    expect(cookie).not.toContain("Secure")
  })

  it("includes Secure when explicitly requested", () => {
    const cookie = createCsrfCookie("mytoken", { secure: true })

    expect(cookie).toContain("Secure")
  })

  it("respects a custom maxAge and sameSite", () => {
    const cookie = createCsrfCookie("mytoken", { maxAge: 3600, sameSite: "lax" })

    expect(cookie).toContain("Max-Age=3600")
    expect(cookie).toContain("SameSite=lax")
  })
})

describe("withCsrfProtection", () => {
  function makeRequest(method: string, token?: string, cookie?: string): Request {
    const headerInit: Record<string, string> = {}
    if (token) headerInit["X-CSRF-Token"] = token
    if (cookie) headerInit["cookie"] = `csrf-token=${cookie}`

    return new Request("http://localhost:3000/api/protected", {
      method,
      headers: headerInit,
    })
  }

  function makeOkHandler(): jest.Mock<Promise<Response>, [Request]> {
    return jest.fn(async (_request: Request) => new Response("ok"))
  }

  it("passes GET requests through without checking CSRF", async () => {
    const handler = makeOkHandler()
    const wrapped = withCsrfProtection(handler)

    const response = await wrapped(makeRequest("GET"))

    expect(handler).toHaveBeenCalledTimes(1)
    expect((response as Response).status).toBe(200)
  })

  it("calls the handler when header and cookie tokens match on POST", async () => {
    const handler = makeOkHandler()
    const wrapped = withCsrfProtection(handler)
    const token = generateCsrfToken()

    const response = await wrapped(makeRequest("POST", token, token))

    expect(handler).toHaveBeenCalledTimes(1)
    expect((response as Response).status).toBe(200)
  })

  it("rejects POST requests with a 403 when tokens are missing", async () => {
    const handler = makeOkHandler()
    const wrapped = withCsrfProtection(handler)

    const response = (await wrapped(makeRequest("POST"))) as Response

    expect(handler).not.toHaveBeenCalled()
    expect(response.status).toBe(403)

    const body = await response.json()
    expect(body.code).toBe("CSRF_TOKEN_INVALID")
  })

  it("rejects state-changing requests when header and cookie tokens mismatch", async () => {
    const handler = makeOkHandler()
    const wrapped = withCsrfProtection(handler)

    const response = (await wrapped(
      makeRequest("PUT", generateCsrfToken(), generateCsrfToken())
    )) as Response

    expect(handler).not.toHaveBeenCalled()
    expect(response.status).toBe(403)
  })

  it("checks CSRF for DELETE and PATCH as well as POST/PUT", async () => {
    const handler = makeOkHandler()
    const wrapped = withCsrfProtection(handler)

    const deleteResponse = (await wrapped(makeRequest("DELETE"))) as Response
    const patchResponse = (await wrapped(makeRequest("PATCH"))) as Response

    expect(deleteResponse.status).toBe(403)
    expect(patchResponse.status).toBe(403)
    expect(handler).not.toHaveBeenCalled()
  })
})

describe("CSRF_HEADER_NAME", () => {
  it("is the canonical header name used by clients", () => {
    expect(CSRF_HEADER_NAME).toBe("X-CSRF-Token")
  })
})

export {}
