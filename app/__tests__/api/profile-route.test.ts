/**
 * @jest-environment node
 */

/**
 * API Route Tests: Profile
 *
 * Tests GET /api/profile and PATCH /api/profile
 */

import { NextRequest } from "next/server"

// ------------------------------------------------------------------
// Mock factories — declared before imports (Jest hoists jest.mock calls)
// ------------------------------------------------------------------

const mockVerifyCsrfToken = jest.fn()
const mockGetCsrfTokenFromRequest = jest.fn()
const mockUserFindUnique = jest.fn()
const mockUserUpdate = jest.fn()
const mockClerkGetUser = jest.fn()
const mockClerkVerifyPassword = jest.fn()
const mockClerkUpdateUser = jest.fn()

jest.mock("@/app/lib/csrf", () => ({
  verifyCsrfToken: (...args: unknown[]) => mockVerifyCsrfToken(...args),
  getCsrfTokenFromRequest: (...args: unknown[]) => mockGetCsrfTokenFromRequest(...args),
}))

jest.mock("@/app/lib/prismadb", () => ({
  __esModule: true,
  default: {
    user: {
      findUnique: (...args: unknown[]) => mockUserFindUnique(...args),
      update: (...args: unknown[]) => mockUserUpdate(...args),
    },
  },
}))

// The profile route does not use rate-limiting directly, but pull in the full
// mock so any transitive imports don't blow up.
jest.mock("@/app/lib/rate-limit", () => {
  const limiter = { check: () => true, reset: () => {}, cleanup: () => {} }
  return {
    apiLimiter: limiter,
    authLimiter: limiter,
    aiChatLimiter: limiter,
    aiTranscribeLimiter: limiter,
    accountDeletionLimiter: limiter,
    twoFactorLimiter: limiter,
    tagLimiter: limiter,
    memoryLimiter: limiter,
    memoryExtractLimiter: limiter,
    templateLimiter: limiter,
    shareLimiter: limiter,
    shareJoinLimiter: limiter,
    csrfLimiter: limiter,
    creatorPaymentLimiter: limiter,
    getClientIdentifier: () => "127.0.0.1",
    withRateLimit: () => {},
    createRateLimiter: () => limiter,
  }
})

jest.mock("@/app/actions/getCurrentUser", () => ({
  __esModule: true,
  default: jest.fn(),
}))

jest.mock("@clerk/nextjs/server", () => ({
  clerkClient: jest.fn(async () => ({
    users: {
      getUser: (...args: unknown[]) => mockClerkGetUser(...args),
      verifyPassword: (...args: unknown[]) => mockClerkVerifyPassword(...args),
      updateUser: (...args: unknown[]) => mockClerkUpdateUser(...args),
    },
  })),
}))

// ------------------------------------------------------------------
// Fixtures
// ------------------------------------------------------------------

const CURRENT_USER = {
  id: "user-11111111-1111-4111-8111-111111111111",
  clerkId: "user_clerk_123",
  email: "alice@example.com",
  name: "Alice",
}

const DB_USER = {
  id: CURRENT_USER.id,
  name: "Alice",
  email: "alice@example.com",
  image: "https://example.com/avatar.png",
  bio: "I love building things.",
  location: "San Francisco, CA",
  website: "https://alice.dev",
  emailVerified: new Date("2024-01-01"),
  clerkId: CURRENT_USER.clerkId,
  createdAt: new Date("2024-01-01"),
  updatedAt: new Date("2024-06-01"),
}

// ------------------------------------------------------------------
// Helpers
// ------------------------------------------------------------------

function makeGetRequest(): NextRequest {
  return new NextRequest("http://localhost:3000/api/profile", {
    method: "GET",
  })
}

function makePatchRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost:3000/api/profile", {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      "X-CSRF-Token": "test-csrf",
      cookie: "csrf-token=test-csrf",
    },
    body: JSON.stringify(body),
  })
}

// ------------------------------------------------------------------
// Tests — GET /api/profile
// ------------------------------------------------------------------

describe("GET /api/profile", () => {
  let GET: (req: NextRequest) => Promise<Response>
  let getCurrentUser: jest.Mock

  beforeAll(async () => {
    const mod = await import("@/app/api/profile/route")
    GET = mod.GET
    const cuMod = await import("@/app/actions/getCurrentUser")
    getCurrentUser = cuMod.default as jest.Mock
  })

  beforeEach(() => {
    jest.clearAllMocks()
    getCurrentUser.mockResolvedValue(CURRENT_USER)
    mockUserFindUnique.mockResolvedValue(DB_USER)
    mockClerkGetUser.mockResolvedValue({ passwordEnabled: true, twoFactorEnabled: true })
  })

  it("returns 401 when user is not authenticated", async () => {
    getCurrentUser.mockResolvedValue(null)
    const res = await GET(makeGetRequest())
    expect(res.status).toBe(401)
    const data = await res.json()
    expect(data.error).toMatch(/unauthorized/i)
  })

  it("returns user profile data for authenticated user", async () => {
    const res = await GET(makeGetRequest())
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.user).toBeDefined()
    expect(data.user.id).toBe(CURRENT_USER.id)
    expect(data.user.name).toBe("Alice")
    expect(data.user.email).toBe("alice@example.com")
    expect(data.user.bio).toBe("I love building things.")
    expect(data.user.location).toBe("San Francisco, CA")
    expect(data.user.website).toBe("https://alice.dev")
    expect(data.user.image).toBe("https://example.com/avatar.png")
    expect(data.hasPassword).toBe(true)
    expect(data.twoFactorEnabled).toBe(true)
  })

  it("returns 404 when user record is not found in database", async () => {
    mockUserFindUnique.mockResolvedValue(null)
    const res = await GET(makeGetRequest())
    expect(res.status).toBe(404)
    const data = await res.json()
    expect(data.error).toMatch(/not found/i)
  })

  it("queries by the current user id", async () => {
    await GET(makeGetRequest())
    expect(mockUserFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: CURRENT_USER.id },
      })
    )
  })
})

// ------------------------------------------------------------------
// Tests — PATCH /api/profile
// ------------------------------------------------------------------

describe("PATCH /api/profile", () => {
  let PATCH: (req: NextRequest) => Promise<Response>
  let getCurrentUser: jest.Mock

  beforeAll(async () => {
    const mod = await import("@/app/api/profile/route")
    PATCH = mod.PATCH
    const cuMod = await import("@/app/actions/getCurrentUser")
    getCurrentUser = cuMod.default as jest.Mock
  })

  beforeEach(() => {
    jest.clearAllMocks()
    mockVerifyCsrfToken.mockReturnValue(true)
    mockGetCsrfTokenFromRequest.mockReturnValue("test-csrf")
    getCurrentUser.mockResolvedValue(CURRENT_USER)
    mockUserUpdate.mockResolvedValue(DB_USER)
    mockClerkGetUser.mockResolvedValue({ passwordEnabled: true, twoFactorEnabled: true })
    mockClerkVerifyPassword.mockResolvedValue({ verified: true })
    mockClerkUpdateUser.mockResolvedValue({ id: CURRENT_USER.clerkId })
  })

  it("returns 403 when CSRF token is invalid", async () => {
    mockVerifyCsrfToken.mockReturnValue(false)
    const res = await PATCH(makePatchRequest({ name: "Bob" }))
    expect(res.status).toBe(403)
    const data = await res.json()
    expect(data.error).toMatch(/csrf/i)
  })

  it("returns 401 when user is not authenticated", async () => {
    getCurrentUser.mockResolvedValue(null)
    const res = await PATCH(makePatchRequest({ name: "Bob" }))
    expect(res.status).toBe(401)
    const data = await res.json()
    expect(data.error).toMatch(/unauthorized/i)
  })

  it("updates name successfully and returns updated user", async () => {
    const updated = { ...DB_USER, name: "Alice Updated" }
    mockUserUpdate.mockResolvedValue(updated)

    const res = await PATCH(makePatchRequest({ name: "Alice Updated" }))
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.message).toMatch(/updated/i)
    expect(data.user.name).toBe("Alice Updated")
    expect(mockUserUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: CURRENT_USER.id },
        data: expect.objectContaining({ name: "Alice Updated" }),
      })
    )
  })

  it("updates bio successfully (within 500 char limit)", async () => {
    const bio = "A".repeat(500)
    const updated = { ...DB_USER, bio }
    mockUserUpdate.mockResolvedValue(updated)

    const res = await PATCH(makePatchRequest({ bio }))
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.user.bio).toBe(bio)
  })

  it("returns 400 when bio exceeds 500 characters", async () => {
    const bio = "A".repeat(501)
    const res = await PATCH(makePatchRequest({ bio }))
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toMatch(/bio too long/i)
    expect(mockUserUpdate).not.toHaveBeenCalled()
  })

  it("changes password successfully when current password is valid", async () => {
    const res = await PATCH(
      makePatchRequest({
        currentPassword: "old-password",
        newPassword: "new-password-123",
      })
    )

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.message).toMatch(/password changed successfully/i)
    expect(mockClerkVerifyPassword).toHaveBeenCalledWith({
      userId: CURRENT_USER.clerkId,
      password: "old-password",
    })
    expect(mockClerkUpdateUser).toHaveBeenCalledWith(CURRENT_USER.clerkId, {
      password: "new-password-123",
      signOutOfOtherSessions: false,
    })
  })

  it("returns 400 when current password is incorrect", async () => {
    mockClerkVerifyPassword.mockRejectedValue(new Error("invalid password"))

    const res = await PATCH(
      makePatchRequest({
        currentPassword: "wrong-password",
        newPassword: "new-password-123",
      })
    )

    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toMatch(/current password is incorrect/i)
  })

  it("updates location successfully (within 100 char limit)", async () => {
    const location = "B".repeat(100)
    const updated = { ...DB_USER, location }
    mockUserUpdate.mockResolvedValue(updated)

    const res = await PATCH(makePatchRequest({ location }))
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.user.location).toBe(location)
  })

  it("returns 400 when location exceeds 100 characters", async () => {
    const location = "C".repeat(101)
    const res = await PATCH(makePatchRequest({ location }))
    expect(res.status).toBe(400)
    expect(mockUserUpdate).not.toHaveBeenCalled()
  })

  it("updates website with a valid URL", async () => {
    const website = "https://alice.dev"
    const updated = { ...DB_USER, website }
    mockUserUpdate.mockResolvedValue(updated)

    const res = await PATCH(makePatchRequest({ website }))
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.user.website).toBe(website)
  })

  it("returns 400 for invalid URL in website field", async () => {
    const res = await PATCH(makePatchRequest({ website: "not-a-url" }))
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toMatch(/invalid url/i)
    expect(mockUserUpdate).not.toHaveBeenCalled()
  })

  it("accepts empty string for website (clears the field)", async () => {
    const updated = { ...DB_USER, website: null }
    mockUserUpdate.mockResolvedValue(updated)

    const res = await PATCH(makePatchRequest({ website: "" }))
    expect(res.status).toBe(200)
    // Empty string is stored as null
    expect(mockUserUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ website: null }),
      })
    )
  })

  it("updates image URL when a valid URL is provided", async () => {
    const image = "https://cdn.example.com/photo.jpg"
    const updated = { ...DB_USER, image }
    mockUserUpdate.mockResolvedValue(updated)

    const res = await PATCH(makePatchRequest({ image }))
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.user.image).toBe(image)
  })

  it("returns 400 when image is an invalid URL", async () => {
    const res = await PATCH(makePatchRequest({ image: "not-a-url" }))
    expect(res.status).toBe(400)
    expect(mockUserUpdate).not.toHaveBeenCalled()
  })

  it("returns 400 when name is an empty string", async () => {
    const res = await PATCH(makePatchRequest({ name: "" }))
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toMatch(/name is required/i)
    expect(mockUserUpdate).not.toHaveBeenCalled()
  })

  it("only includes provided fields in the database update", async () => {
    mockUserUpdate.mockResolvedValue({ ...DB_USER, bio: "New bio" })

    const res = await PATCH(makePatchRequest({ bio: "New bio" }))
    expect(res.status).toBe(200)

    // name, image, location, website should NOT appear in update data
    const callArg = (mockUserUpdate as jest.Mock).mock.calls[0][0]
    expect(callArg.data).not.toHaveProperty("name")
    expect(callArg.data).not.toHaveProperty("image")
    expect(callArg.data).not.toHaveProperty("location")
    expect(callArg.data).not.toHaveProperty("website")
    expect(callArg.data.bio).toBe("New bio")
  })

  it("returns 500 when a database error occurs", async () => {
    mockUserUpdate.mockRejectedValue(new Error("DB connection failed"))

    const res = await PATCH(makePatchRequest({ name: "Alice" }))
    expect(res.status).toBe(500)
  })
})

export {}
