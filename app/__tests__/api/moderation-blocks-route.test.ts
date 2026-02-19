/**
 * @jest-environment node
 */

/**
 * API Route Tests: Moderation Blocks
 *
 * Tests GET / POST / DELETE /api/moderation/blocks
 *
 * Route behaviour:
 *   GET    — Returns all blocks where current user is the blocker (no CSRF needed)
 *   POST   — Blocks a user; requires CSRF. Idempotent via upsert. Validates:
 *              - cannot block yourself
 *              - blockedUserId must be a valid UUID
 *   DELETE — Unblocks a user; requires CSRF. Uses deleteMany (no error if row absent).
 *
 * Note: The route does NOT independently look up the target user before blocking —
 * it relies on the database FK constraint. We therefore test the 400 self-block path
 * and rely on Zod UUID validation to reject malformed IDs. A separate "target user
 * not found" scenario is not enforced at the HTTP layer (the upsert would succeed or
 * fail with a DB FK error → 500).
 */

import { NextRequest } from "next/server"

// ------------------------------------------------------------------
// Mock declarations
// ------------------------------------------------------------------

const mockAuth = jest.fn()
const mockVerifyCsrfToken = jest.fn()
const mockGetCsrfTokenFromRequest = jest.fn()
const mockUserFindUnique = jest.fn()
const mockUserBlockFindMany = jest.fn()
const mockUserBlockUpsert = jest.fn()
const mockUserBlockDeleteMany = jest.fn()

jest.mock("@clerk/nextjs/server", () => ({
  auth: () => mockAuth(),
}))

jest.mock("@/app/lib/csrf", () => ({
  verifyCsrfToken: (...args: unknown[]) => mockVerifyCsrfToken(...args),
  getCsrfTokenFromRequest: (...args: unknown[]) => mockGetCsrfTokenFromRequest(...args),
}))

jest.mock("@/app/lib/prismadb", () => ({
  __esModule: true,
  default: {
    user: {
      findUnique: (...args: unknown[]) => mockUserFindUnique(...args),
    },
    userBlock: {
      findMany: (...args: unknown[]) => mockUserBlockFindMany(...args),
      upsert: (...args: unknown[]) => mockUserBlockUpsert(...args),
      deleteMany: (...args: unknown[]) => mockUserBlockDeleteMany(...args),
    },
  },
}))

// ------------------------------------------------------------------
// Fixtures
// ------------------------------------------------------------------

// Use valid RFC 4122 v4 UUIDs throughout — the route applies Zod `.uuid()`
// validation which in Zod v4 enforces proper version (4) and variant (8-b) bits.
const CURRENT_USER_CLERK_ID = "clerk_user_1"
const CURRENT_USER = {
  id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
  email: "me@example.com",
  name: "Current User",
}

const TARGET_USER_ID = "b1cde23a-4f5d-4e6f-8a7b-9c0d1e2f3a4b"

const BLOCK_RECORD = {
  id: "block-1",
  blockerId: CURRENT_USER.id,
  blockedId: TARGET_USER_ID,
  reason: null,
  createdAt: new Date().toISOString(),
  blocked: {
    id: TARGET_USER_ID,
    name: "Blocked User",
    email: "blocked@example.com",
    image: null,
  },
}

// ------------------------------------------------------------------
// Request builders
// ------------------------------------------------------------------

function makeGetRequest(): NextRequest {
  return new NextRequest("http://localhost:3000/api/moderation/blocks", {
    method: "GET",
    headers: {
      cookie: "csrf-token=test-csrf",
    },
  })
}

function makePostRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost:3000/api/moderation/blocks", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-CSRF-Token": "test-csrf",
      cookie: "csrf-token=test-csrf",
    },
    body: JSON.stringify(body),
  })
}

function makeDeleteRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost:3000/api/moderation/blocks", {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
      "X-CSRF-Token": "test-csrf",
      cookie: "csrf-token=test-csrf",
    },
    body: JSON.stringify(body),
  })
}

// ------------------------------------------------------------------
// Tests
// ------------------------------------------------------------------

describe("GET /api/moderation/blocks", () => {
  let GET: (req: NextRequest) => Promise<Response>

  beforeAll(async () => {
    const mod = await import("@/app/api/moderation/blocks/route")
    GET = mod.GET
  })

  beforeEach(() => {
    jest.clearAllMocks()
    mockUserFindUnique.mockReset()
    mockUserBlockFindMany.mockReset()
    mockUserBlockUpsert.mockReset()
    mockUserBlockDeleteMany.mockReset()
    mockAuth.mockResolvedValue({ userId: CURRENT_USER_CLERK_ID })
    mockUserFindUnique.mockResolvedValue(CURRENT_USER)
    mockUserBlockFindMany.mockResolvedValue([BLOCK_RECORD])
  })

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue({ userId: null })
    const res = await GET(makeGetRequest())
    expect(res.status).toBe(401)
  })

  it("returns 401 when authenticated Clerk user has no local database record", async () => {
    mockUserFindUnique.mockResolvedValue(null)
    const res = await GET(makeGetRequest())
    expect(res.status).toBe(401)
  })

  it("returns 200 with the list of blocks for the current user", async () => {
    const res = await GET(makeGetRequest())
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(Array.isArray(data.blocks)).toBe(true)
    expect(data.blocks).toHaveLength(1)
    expect(data.blocks[0].blockerId).toBe(CURRENT_USER.id)
  })

  it("queries blocks where current user is the blocker, ordered by createdAt desc", async () => {
    await GET(makeGetRequest())
    expect(mockUserBlockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { blockerId: CURRENT_USER.id },
        orderBy: { createdAt: "desc" },
      })
    )
  })

  it("returns an empty blocks array when the user has not blocked anyone", async () => {
    mockUserBlockFindMany.mockResolvedValue([])
    const res = await GET(makeGetRequest())
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.blocks).toHaveLength(0)
  })
})

describe("POST /api/moderation/blocks", () => {
  let POST: (req: NextRequest) => Promise<Response>

  beforeAll(async () => {
    const mod = await import("@/app/api/moderation/blocks/route")
    POST = mod.POST
  })

  beforeEach(() => {
    jest.clearAllMocks()
    mockUserFindUnique.mockReset()
    mockUserBlockUpsert.mockReset()
    mockUserBlockDeleteMany.mockReset()
    mockUserBlockFindMany.mockReset()
    mockAuth.mockResolvedValue({ userId: CURRENT_USER_CLERK_ID })
    mockVerifyCsrfToken.mockReturnValue(true)
    mockGetCsrfTokenFromRequest.mockReturnValue("test-csrf")
    mockUserFindUnique.mockResolvedValue(CURRENT_USER)
    mockUserBlockUpsert.mockResolvedValue(BLOCK_RECORD)
  })

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue({ userId: null })
    const res = await POST(makePostRequest({ blockedUserId: TARGET_USER_ID }))
    expect(res.status).toBe(401)
  })

  it("returns 403 when CSRF token is invalid", async () => {
    mockVerifyCsrfToken.mockReturnValue(false)
    const res = await POST(makePostRequest({ blockedUserId: TARGET_USER_ID }))
    expect(res.status).toBe(403)
  })

  it("returns 400 when attempting to block yourself", async () => {
    const res = await POST(makePostRequest({ blockedUserId: CURRENT_USER.id }))
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toMatch(/cannot block yourself/i)
    expect(mockUserBlockUpsert).not.toHaveBeenCalled()
  })

  it("returns 400 when blockedUserId is not a valid UUID", async () => {
    const res = await POST(makePostRequest({ blockedUserId: "not-a-uuid" }))
    expect(res.status).toBe(400)
    expect(mockUserBlockUpsert).not.toHaveBeenCalled()
  })

  it("returns 400 when blockedUserId is missing from the request body", async () => {
    const res = await POST(makePostRequest({}))
    expect(res.status).toBe(400)
    expect(mockUserBlockUpsert).not.toHaveBeenCalled()
  })

  it("blocks a user successfully and returns 201 with the block record", async () => {
    const res = await POST(makePostRequest({ blockedUserId: TARGET_USER_ID }))
    expect(res.status).toBe(201)
    const data = await res.json()
    expect(data.block).toBeDefined()
    expect(data.block.blockerId).toBe(CURRENT_USER.id)
    expect(data.block.blockedId).toBe(TARGET_USER_ID)
  })

  it("calls upsert with correct blocker/blocked ids so blocking is idempotent", async () => {
    await POST(makePostRequest({ blockedUserId: TARGET_USER_ID }))
    expect(mockUserBlockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          blockerId_blockedId: {
            blockerId: CURRENT_USER.id,
            blockedId: TARGET_USER_ID,
          },
        },
        create: expect.objectContaining({
          blockerId: CURRENT_USER.id,
          blockedId: TARGET_USER_ID,
        }),
      })
    )
  })

  it("passes optional reason through when provided", async () => {
    const reason = "Spamming messages"
    await POST(makePostRequest({ blockedUserId: TARGET_USER_ID, reason }))
    expect(mockUserBlockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ reason }),
      })
    )
  })

  // NOTE: The POST handler in the blocks route does not wrap its body in a try/catch,
  // so database errors propagate as unhandled rejections rather than 500 responses.
  // A 500 test is omitted here; fixing the route's error handling is tracked separately.
})

describe("DELETE /api/moderation/blocks", () => {
  let DELETE: (req: NextRequest) => Promise<Response>

  beforeAll(async () => {
    const mod = await import("@/app/api/moderation/blocks/route")
    DELETE = mod.DELETE
  })

  beforeEach(() => {
    jest.clearAllMocks()
    mockUserFindUnique.mockReset()
    mockUserBlockDeleteMany.mockReset()
    mockUserBlockUpsert.mockReset()
    mockUserBlockFindMany.mockReset()
    mockAuth.mockResolvedValue({ userId: CURRENT_USER_CLERK_ID })
    mockVerifyCsrfToken.mockReturnValue(true)
    mockGetCsrfTokenFromRequest.mockReturnValue("test-csrf")
    mockUserFindUnique.mockResolvedValue(CURRENT_USER)
    mockUserBlockDeleteMany.mockResolvedValue({ count: 1 })
  })

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue({ userId: null })
    const res = await DELETE(makeDeleteRequest({ blockedUserId: TARGET_USER_ID }))
    expect(res.status).toBe(401)
  })

  it("returns 403 when CSRF token is invalid", async () => {
    mockVerifyCsrfToken.mockReturnValue(false)
    const res = await DELETE(makeDeleteRequest({ blockedUserId: TARGET_USER_ID }))
    expect(res.status).toBe(403)
  })

  it("unblocks a user successfully and returns success", async () => {
    const res = await DELETE(makeDeleteRequest({ blockedUserId: TARGET_USER_ID }))
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.success).toBe(true)
  })

  it("calls deleteMany with the correct blocker and blocked ids", async () => {
    await DELETE(makeDeleteRequest({ blockedUserId: TARGET_USER_ID }))
    expect(mockUserBlockDeleteMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          blockerId: CURRENT_USER.id,
          blockedId: TARGET_USER_ID,
        },
      })
    )
  })

  it("is idempotent — succeeds even when the block relationship does not exist", async () => {
    // deleteMany returns count: 0 when nothing was deleted but does not throw
    mockUserBlockDeleteMany.mockResolvedValue({ count: 0 })
    const res = await DELETE(makeDeleteRequest({ blockedUserId: TARGET_USER_ID }))
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.success).toBe(true)
  })

  it("returns 400 when blockedUserId is not a valid UUID", async () => {
    const res = await DELETE(makeDeleteRequest({ blockedUserId: "invalid-id" }))
    expect(res.status).toBe(400)
    expect(mockUserBlockDeleteMany).not.toHaveBeenCalled()
  })

  // NOTE: The DELETE handler in the blocks route does not wrap its body in a try/catch,
  // so database errors propagate as unhandled rejections rather than 500 responses.
  // A 500 test is omitted here; fixing the route's error handling is tracked separately.
})

export {}
