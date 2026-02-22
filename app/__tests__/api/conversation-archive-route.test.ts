/**
 * @jest-environment node
 */

/**
 * API Route Tests: Conversation Archive
 *
 * Tests POST /api/conversations/[id]/archive and
 *       DELETE /api/conversations/[id]/archive
 */

import { NextRequest } from "next/server"

// ------------------------------------------------------------------
// Mock factories
// ------------------------------------------------------------------

const mockVerifyCsrfToken = jest.fn()
const mockGetCsrfTokenFromRequest = jest.fn()
const mockConversationFindUnique = jest.fn()
const mockConversationUpdate = jest.fn()
const mockPusherTrigger = jest.fn()

jest.mock("@/app/lib/csrf", () => ({
  verifyCsrfToken: (...args: unknown[]) => mockVerifyCsrfToken(...args),
  getCsrfTokenFromRequest: (...args: unknown[]) => mockGetCsrfTokenFromRequest(...args),
}))

jest.mock("@/app/lib/prismadb", () => ({
  __esModule: true,
  default: {
    conversation: {
      findUnique: (...args: unknown[]) => mockConversationFindUnique(...args),
      update: (...args: unknown[]) => mockConversationUpdate(...args),
    },
  },
}))

jest.mock("@/app/lib/pusher", () => ({
  pusherServer: {
    trigger: (...args: unknown[]) => mockPusherTrigger(...args),
  },
}))

jest.mock("@/app/lib/pusher-channels", () => ({
  getPusherUserChannel: (id: string) => `private-user-${id}`,
}))

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

// ------------------------------------------------------------------
// Fixtures
// ------------------------------------------------------------------

const CURRENT_USER = {
  id: "user-11111111-1111-4111-8111-111111111111",
  email: "alice@example.com",
  name: "Alice",
}

const CONV_ID = "conv-22222222-2222-4222-8222-222222222222"

function makeConversation(overrides: Record<string, unknown> = {}) {
  return {
    id: CONV_ID,
    name: "Test Conversation",
    archivedBy: [],
    archivedAt: null,
    users: [CURRENT_USER],
    messages: [],
    ...overrides,
  }
}

function makeUpdatedConversation(overrides: Record<string, unknown> = {}) {
  return {
    ...makeConversation(),
    users: [CURRENT_USER],
    messages: [],
    ...overrides,
  }
}

// ------------------------------------------------------------------
// Helpers
// ------------------------------------------------------------------

function makeRequest(method: "POST" | "DELETE"): NextRequest {
  return new NextRequest(`http://localhost:3000/api/conversations/${CONV_ID}/archive`, {
    method,
    headers: {
      "Content-Type": "application/json",
      "X-CSRF-Token": "test-csrf",
      cookie: "csrf-token=test-csrf",
    },
  })
}

// ------------------------------------------------------------------
// Tests — POST (archive)
// ------------------------------------------------------------------

describe("POST /api/conversations/[conversationId]/archive", () => {
  let POST: (
    req: NextRequest,
    ctx: { params: Promise<{ conversationId: string }> }
  ) => Promise<Response>
  let getCurrentUser: jest.Mock

  beforeAll(async () => {
    const mod = await import("@/app/api/conversations/[conversationId]/archive/route")
    POST = mod.POST
    const cuMod = await import("@/app/actions/getCurrentUser")
    getCurrentUser = cuMod.default as jest.Mock
  })

  beforeEach(() => {
    jest.clearAllMocks()
    mockVerifyCsrfToken.mockReturnValue(true)
    mockGetCsrfTokenFromRequest.mockReturnValue("test-csrf")
    getCurrentUser.mockResolvedValue(CURRENT_USER)
    mockConversationFindUnique.mockResolvedValue(makeConversation())
    mockConversationUpdate.mockResolvedValue(
      makeUpdatedConversation({ archivedBy: [CURRENT_USER.id], archivedAt: new Date() })
    )
    mockPusherTrigger.mockResolvedValue(undefined)
  })

  async function callPost(convId: string = CONV_ID) {
    const req = makeRequest("POST")
    return POST(req, { params: Promise.resolve({ conversationId: convId }) })
  }

  it("returns 403 when CSRF token is invalid", async () => {
    mockVerifyCsrfToken.mockReturnValue(false)
    const res = await callPost()
    expect(res.status).toBe(403)
    const data = await res.json()
    expect(data.error).toMatch(/csrf/i)
  })

  it("returns 401 when user is not authenticated", async () => {
    getCurrentUser.mockResolvedValue(null)
    const res = await callPost()
    expect(res.status).toBe(401)
    const data = await res.json()
    expect(data.error).toMatch(/unauthorized/i)
  })

  it("returns 404 when conversation is not found", async () => {
    mockConversationFindUnique.mockResolvedValue(null)
    const res = await callPost()
    expect(res.status).toBe(404)
    const data = await res.json()
    expect(data.error).toMatch(/not found/i)
  })

  it("returns 403 when user is not a participant in the conversation", async () => {
    mockConversationFindUnique.mockResolvedValue(
      makeConversation({ users: [{ id: "other-user", email: "other@example.com" }] })
    )
    const res = await callPost()
    expect(res.status).toBe(403)
    const data = await res.json()
    expect(data.error).toMatch(/not part of this conversation/i)
  })

  it("archives the conversation and returns updated conversation", async () => {
    const res = await callPost()
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.id).toBe(CONV_ID)
    expect(mockConversationUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: CONV_ID },
        data: expect.objectContaining({
          archivedBy: [CURRENT_USER.id],
        }),
      })
    )
  })

  it("returns 400 when conversation is already archived by this user", async () => {
    mockConversationFindUnique.mockResolvedValue(
      makeConversation({ archivedBy: [CURRENT_USER.id] })
    )
    const res = await callPost()
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toMatch(/already archived/i)
    expect(mockConversationUpdate).not.toHaveBeenCalled()
  })

  it("triggers Pusher conversation:archive event on the user channel", async () => {
    await callPost()
    expect(mockPusherTrigger).toHaveBeenCalledWith(
      `private-user-${CURRENT_USER.id}`,
      "conversation:archive",
      expect.anything()
    )
  })

  it("sets archivedAt when first user archives the conversation", async () => {
    // archivedBy is empty — first archive
    mockConversationFindUnique.mockResolvedValue(makeConversation({ archivedBy: [] }))

    await callPost()

    const callData = (mockConversationUpdate as jest.Mock).mock.calls[0][0].data
    expect(callData.archivedAt).toBeInstanceOf(Date)
  })

  it("preserves existing archivedAt when a second user archives", async () => {
    const existingDate = new Date("2025-01-01")
    mockConversationFindUnique.mockResolvedValue(
      makeConversation({
        archivedBy: ["other-user-id"],
        archivedAt: existingDate,
        users: [CURRENT_USER, { id: "other-user-id", email: "other@example.com" }],
      })
    )

    await callPost()

    const callData = (mockConversationUpdate as jest.Mock).mock.calls[0][0].data
    expect(callData.archivedAt).toEqual(existingDate)
  })
})

// ------------------------------------------------------------------
// Tests — DELETE (unarchive)
// ------------------------------------------------------------------

describe("DELETE /api/conversations/[conversationId]/archive", () => {
  let DELETE: (
    req: NextRequest,
    ctx: { params: Promise<{ conversationId: string }> }
  ) => Promise<Response>
  let getCurrentUser: jest.Mock

  beforeAll(async () => {
    const mod = await import("@/app/api/conversations/[conversationId]/archive/route")
    DELETE = mod.DELETE
    const cuMod = await import("@/app/actions/getCurrentUser")
    getCurrentUser = cuMod.default as jest.Mock
  })

  beforeEach(() => {
    jest.clearAllMocks()
    mockVerifyCsrfToken.mockReturnValue(true)
    mockGetCsrfTokenFromRequest.mockReturnValue("test-csrf")
    getCurrentUser.mockResolvedValue(CURRENT_USER)
    // Conversation is currently archived by the current user
    mockConversationFindUnique.mockResolvedValue(
      makeConversation({ archivedBy: [CURRENT_USER.id], archivedAt: new Date() })
    )
    mockConversationUpdate.mockResolvedValue(
      makeUpdatedConversation({ archivedBy: [], archivedAt: null })
    )
    mockPusherTrigger.mockResolvedValue(undefined)
  })

  async function callDelete(convId: string = CONV_ID) {
    const req = makeRequest("DELETE")
    return DELETE(req, { params: Promise.resolve({ conversationId: convId }) })
  }

  it("returns 403 when CSRF token is invalid", async () => {
    mockVerifyCsrfToken.mockReturnValue(false)
    const res = await callDelete()
    expect(res.status).toBe(403)
  })

  it("returns 401 when user is not authenticated", async () => {
    getCurrentUser.mockResolvedValue(null)
    const res = await callDelete()
    expect(res.status).toBe(401)
  })

  it("returns 404 when conversation is not found", async () => {
    mockConversationFindUnique.mockResolvedValue(null)
    const res = await callDelete()
    expect(res.status).toBe(404)
  })

  it("returns 403 when user is not a participant", async () => {
    mockConversationFindUnique.mockResolvedValue(
      makeConversation({
        archivedBy: [CURRENT_USER.id],
        users: [{ id: "other-user", email: "other@example.com" }],
      })
    )
    const res = await callDelete()
    expect(res.status).toBe(403)
  })

  it("returns 400 when conversation is not archived by this user", async () => {
    mockConversationFindUnique.mockResolvedValue(makeConversation({ archivedBy: [] }))
    const res = await callDelete()
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toMatch(/not archived/i)
  })

  it("unarchives the conversation and returns updated conversation", async () => {
    const res = await callDelete()
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.id).toBe(CONV_ID)
    expect(mockConversationUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: CONV_ID },
        data: expect.objectContaining({
          archivedBy: [],
        }),
      })
    )
  })

  it("clears archivedAt when the last user unarchives", async () => {
    // Only current user had archived it
    mockConversationFindUnique.mockResolvedValue(
      makeConversation({ archivedBy: [CURRENT_USER.id], archivedAt: new Date() })
    )

    await callDelete()

    const callData = (mockConversationUpdate as jest.Mock).mock.calls[0][0].data
    expect(callData.archivedAt).toBeNull()
  })

  it("preserves archivedAt when other users still have it archived", async () => {
    const existingDate = new Date("2025-01-01")
    mockConversationFindUnique.mockResolvedValue(
      makeConversation({
        archivedBy: [CURRENT_USER.id, "other-user-id"],
        archivedAt: existingDate,
        users: [CURRENT_USER, { id: "other-user-id", email: "other@example.com" }],
      })
    )

    await callDelete()

    const callData = (mockConversationUpdate as jest.Mock).mock.calls[0][0].data
    expect(callData.archivedAt).toEqual(existingDate)
  })

  it("triggers Pusher conversation:unarchive event on the user channel", async () => {
    await callDelete()
    expect(mockPusherTrigger).toHaveBeenCalledWith(
      `private-user-${CURRENT_USER.id}`,
      "conversation:unarchive",
      expect.anything()
    )
  })
})

export {}
