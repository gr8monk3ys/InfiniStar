/**
 * @jest-environment node
 */

import { NextRequest } from "next/server"

const mockVerifyCsrfToken = jest.fn()
const mockGetCsrfTokenFromRequest = jest.fn()
const mockFindFallbackUserByEmail = jest.fn()
const mockVerifyFallbackPassword = jest.fn()
const mockCreateFallbackSession = jest.fn()
const mockApplyFallbackSessionCookie = jest.fn()
const mockIsFallbackAuthEnabled = jest.fn()
const mockCreateFallbackClerkId = jest.fn()
const mockHashFallbackPassword = jest.fn()
const mockGetFallbackSessionTokenFromCookies = jest.fn()
const mockRevokeFallbackSessionByToken = jest.fn()
const mockClearFallbackSessionCookie = jest.fn()
const mockUserFindUnique = jest.fn()
const mockUserCreate = jest.fn()

jest.mock("@/app/lib/csrf", () => ({
  verifyCsrfToken: (...args: unknown[]) => mockVerifyCsrfToken(...args),
  getCsrfTokenFromRequest: (...args: unknown[]) => mockGetCsrfTokenFromRequest(...args),
}))

jest.mock("@/app/lib/fallback-auth", () => ({
  findFallbackUserByEmail: (...args: unknown[]) => mockFindFallbackUserByEmail(...args),
  verifyFallbackPassword: (...args: unknown[]) => mockVerifyFallbackPassword(...args),
  createFallbackSession: (...args: unknown[]) => mockCreateFallbackSession(...args),
  applyFallbackSessionCookie: (...args: unknown[]) => mockApplyFallbackSessionCookie(...args),
  isFallbackAuthEnabled: (...args: unknown[]) => mockIsFallbackAuthEnabled(...args),
  createFallbackClerkId: (...args: unknown[]) => mockCreateFallbackClerkId(...args),
  hashFallbackPassword: (...args: unknown[]) => mockHashFallbackPassword(...args),
  getFallbackSessionTokenFromCookies: (...args: unknown[]) =>
    mockGetFallbackSessionTokenFromCookies(...args),
  revokeFallbackSessionByToken: (...args: unknown[]) => mockRevokeFallbackSessionByToken(...args),
  clearFallbackSessionCookie: (...args: unknown[]) => mockClearFallbackSessionCookie(...args),
}))

jest.mock("@/app/lib/prismadb", () => ({
  __esModule: true,
  default: {
    user: {
      findUnique: (...args: unknown[]) => mockUserFindUnique(...args),
      create: (...args: unknown[]) => mockUserCreate(...args),
    },
  },
}))

function makeRequest(url: string, body: unknown) {
  return new NextRequest(`http://localhost:3000${url}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-CSRF-Token": "csrf-token",
      cookie: "csrf-token=csrf-token",
    },
    body: JSON.stringify(body),
  })
}

describe("fallback auth routes", () => {
  let signInPost: (request: NextRequest) => Promise<Response>
  let signUpPost: (request: NextRequest) => Promise<Response>
  let signOutPost: (request: NextRequest) => Promise<Response>

  beforeAll(async () => {
    signInPost = (await import("@/app/api/auth/fallback/sign-in/route")).POST
    signUpPost = (await import("@/app/api/auth/fallback/sign-up/route")).POST
    signOutPost = (await import("@/app/api/auth/fallback/sign-out/route")).POST
  })

  beforeEach(() => {
    jest.clearAllMocks()
    mockVerifyCsrfToken.mockReturnValue(true)
    mockGetCsrfTokenFromRequest.mockReturnValue("csrf-token")
    mockIsFallbackAuthEnabled.mockReturnValue(true)
    mockCreateFallbackClerkId.mockReturnValue("fallback_test_123")
    mockHashFallbackPassword.mockResolvedValue("hashed-password")
    mockCreateFallbackSession.mockResolvedValue({
      sessionToken: "session-token",
      expiresAt: new Date("2026-12-31T00:00:00.000Z"),
    })
  })

  it("signs in with fallback credentials", async () => {
    mockFindFallbackUserByEmail.mockResolvedValue({
      id: "user-1",
      email: "alice@example.com",
      name: "Alice",
      image: null,
      hashedPassword: "stored-hash",
    })
    mockVerifyFallbackPassword.mockResolvedValue(true)

    const response = await signInPost(
      makeRequest("/api/auth/fallback/sign-in", {
        email: "alice@example.com",
        password: "Password!123",
        redirectPath: "/dashboard/conversations",
      })
    )

    expect(response.status).toBe(200)
    expect(mockCreateFallbackSession).toHaveBeenCalledWith("user-1")
    expect(mockApplyFallbackSessionCookie).toHaveBeenCalledWith(
      expect.any(Object),
      "session-token",
      expect.any(Date)
    )

    const payload = await response.json()
    expect(payload.authMode).toBe("fallback")
    expect(payload.redirectPath).toBe("/dashboard/conversations")
  })

  it("rejects invalid fallback credentials", async () => {
    mockFindFallbackUserByEmail.mockResolvedValue({
      id: "user-1",
      email: "alice@example.com",
      name: "Alice",
      image: null,
      hashedPassword: "stored-hash",
    })
    mockVerifyFallbackPassword.mockResolvedValue(false)

    const response = await signInPost(
      makeRequest("/api/auth/fallback/sign-in", {
        email: "alice@example.com",
        password: "wrong-password",
      })
    )

    expect(response.status).toBe(401)
  })

  it("creates a fallback account on sign up", async () => {
    mockUserFindUnique.mockResolvedValue(null)
    mockUserCreate.mockResolvedValue({
      id: "user-2",
      email: "new@example.com",
      image: null,
      name: "New User",
    })

    const response = await signUpPost(
      makeRequest("/api/auth/fallback/sign-up", {
        email: "new@example.com",
        name: "New User",
        password: "Password!123",
      })
    )

    expect(response.status).toBe(200)
    expect(mockUserCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          clerkId: "fallback_test_123",
          email: "new@example.com",
          hashedPassword: "hashed-password",
        }),
      })
    )
    expect(mockCreateFallbackSession).toHaveBeenCalledWith("user-2")
  })

  it("blocks duplicate emails on sign up", async () => {
    mockUserFindUnique.mockResolvedValue({
      id: "user-existing",
      hashedPassword: "existing-password",
    })

    const response = await signUpPost(
      makeRequest("/api/auth/fallback/sign-up", {
        email: "existing@example.com",
        name: "Existing User",
        password: "Password!123",
      })
    )

    expect(response.status).toBe(409)
  })

  it("signs out by revoking the fallback session", async () => {
    mockGetFallbackSessionTokenFromCookies.mockResolvedValue("session-token")

    const response = await signOutPost(makeRequest("/api/auth/fallback/sign-out", {}))

    expect(response.status).toBe(200)
    expect(mockRevokeFallbackSessionByToken).toHaveBeenCalledWith("session-token")
    expect(mockClearFallbackSessionCookie).toHaveBeenCalledWith(expect.any(Object))
  })

  it("returns 404 when fallback auth is disabled", async () => {
    mockIsFallbackAuthEnabled.mockReturnValue(false)

    const response = await signInPost(
      makeRequest("/api/auth/fallback/sign-in", {
        email: "alice@example.com",
        password: "Password!123",
      })
    )

    expect(response.status).toBe(404)
  })
})
