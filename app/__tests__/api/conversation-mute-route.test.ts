/**
 * @jest-environment node
 */

/**
 * API Route Tests: Conversation Mute
 *
 * Tests POST /api/conversations/[id]/mute and
 *       DELETE /api/conversations/[id]/mute
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

jest.mock("@/app/lib/pusher-server", () => ({
  pusherServer: {
    trigger: (...args: unknown[]) => mockPusherTrigger(...args),
  },
}))

jest.mock("@/app/lib/pusher-channels", () => ({
  PUSHER_PRESENCE_CHANNEL: "presence-messenger",
  getPusherUserChannel: (id: string) => `private-user-${id}`,
  getPusherConversationChannel: (id: string) => `private-conversation-${id}`,
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
  id: "user-44444444-4444-4444-8444-444444444444",
  email: "bob@example.com",
  name: "Bob",
}

const CONV_ID = "conv-55555555-5555-4555-8555-555555555555"

function makeConversation(overrides: Record<string, unknown> = {}) {
  return {
    id: CONV_ID,
    name: "Test Conversation",
    mutedBy: [],
    mutedAt: null,
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
  return new NextRequest(`http://localhost:3000/api/conversations/${CONV_ID}/mute`, {
    method,
    headers: {
      "Content-Type": "application/json",
      "X-CSRF-Token": "test-csrf",
      cookie: "csrf-token=test-csrf",
    },
  })
}

// ------------------------------------------------------------------
// Tests — POST (mute)
// ------------------------------------------------------------------

describe("POST /api/conversations/[conversationId]/mute", () => {
  let POST: (
    req: NextRequest,
    ctx: { params: Promise<{ conversationId: string }> }
  ) => Promise<Response>
  let getCurrentUser: jest.Mock

  beforeAll(async () => {
    const mod = await import("@/app/api/conversations/[conversationId]/mute/route")
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
      makeUpdatedConversation({ mutedBy: [CURRENT_USER.id], mutedAt: new Date() })
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

  it("mutes the conversation and returns updated conversation", async () => {
    const res = await callPost()
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.id).toBe(CONV_ID)
    expect(mockConversationUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: CONV_ID },
        data: expect.objectContaining({
          mutedBy: [CURRENT_USER.id],
        }),
      })
    )
  })

  it("returns 400 when conversation is already muted by this user (idempotent guard)", async () => {
    mockConversationFindUnique.mockResolvedValue(makeConversation({ mutedBy: [CURRENT_USER.id] }))
    const res = await callPost()
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toMatch(/already muted/i)
    expect(mockConversationUpdate).not.toHaveBeenCalled()
  })

  it("triggers Pusher conversation:mute event on the user channel", async () => {
    await callPost()
    expect(mockPusherTrigger).toHaveBeenCalledWith(
      `private-user-${CURRENT_USER.id}`,
      "conversation:mute",
      expect.anything()
    )
  })

  it("sets mutedAt when first user mutes the conversation", async () => {
    mockConversationFindUnique.mockResolvedValue(makeConversation({ mutedBy: [] }))

    await callPost()

    const callData = (mockConversationUpdate as jest.Mock).mock.calls[0][0].data
    expect(callData.mutedAt).toBeInstanceOf(Date)
  })

  it("preserves existing mutedAt when a second user mutes", async () => {
    const existingDate = new Date("2025-05-01")
    mockConversationFindUnique.mockResolvedValue(
      makeConversation({
        mutedBy: ["other-user-id"],
        mutedAt: existingDate,
        users: [CURRENT_USER, { id: "other-user-id", email: "other@example.com" }],
      })
    )
    mockConversationUpdate.mockResolvedValue(
      makeUpdatedConversation({
        mutedBy: ["other-user-id", CURRENT_USER.id],
        mutedAt: existingDate,
      })
    )

    await callPost()

    const callData = (mockConversationUpdate as jest.Mock).mock.calls[0][0].data
    expect(callData.mutedAt).toEqual(existingDate)
  })

  it("allows another user to mute independently of the current user", async () => {
    const otherUserId = "other-user-id"
    mockConversationFindUnique.mockResolvedValue(
      makeConversation({
        mutedBy: [otherUserId],
        users: [CURRENT_USER, { id: otherUserId, email: "other@example.com" }],
      })
    )
    mockConversationUpdate.mockResolvedValue(
      makeUpdatedConversation({ mutedBy: [otherUserId, CURRENT_USER.id] })
    )

    const res = await callPost()
    expect(res.status).toBe(200)
    expect(mockConversationUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          mutedBy: [otherUserId, CURRENT_USER.id],
        }),
      })
    )
  })
})

// ------------------------------------------------------------------
// Tests — DELETE (unmute)
// ------------------------------------------------------------------

describe("DELETE /api/conversations/[conversationId]/mute", () => {
  let DELETE: (
    req: NextRequest,
    ctx: { params: Promise<{ conversationId: string }> }
  ) => Promise<Response>
  let getCurrentUser: jest.Mock

  beforeAll(async () => {
    const mod = await import("@/app/api/conversations/[conversationId]/mute/route")
    DELETE = mod.DELETE
    const cuMod = await import("@/app/actions/getCurrentUser")
    getCurrentUser = cuMod.default as jest.Mock
  })

  beforeEach(() => {
    jest.clearAllMocks()
    mockVerifyCsrfToken.mockReturnValue(true)
    mockGetCsrfTokenFromRequest.mockReturnValue("test-csrf")
    getCurrentUser.mockResolvedValue(CURRENT_USER)
    // Conversation is currently muted by the current user
    mockConversationFindUnique.mockResolvedValue(
      makeConversation({ mutedBy: [CURRENT_USER.id], mutedAt: new Date() })
    )
    mockConversationUpdate.mockResolvedValue(
      makeUpdatedConversation({ mutedBy: [], mutedAt: null })
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
        mutedBy: [CURRENT_USER.id],
        users: [{ id: "other-user", email: "other@example.com" }],
      })
    )
    const res = await callDelete()
    expect(res.status).toBe(403)
  })

  it("returns 400 when conversation is not muted by this user", async () => {
    mockConversationFindUnique.mockResolvedValue(makeConversation({ mutedBy: [] }))
    const res = await callDelete()
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toMatch(/not muted/i)
  })

  it("unmutes the conversation and returns updated conversation", async () => {
    const res = await callDelete()
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.id).toBe(CONV_ID)
    expect(mockConversationUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: CONV_ID },
        data: expect.objectContaining({
          mutedBy: [],
        }),
      })
    )
  })

  it("clears mutedAt when the last user unmutes", async () => {
    mockConversationFindUnique.mockResolvedValue(
      makeConversation({ mutedBy: [CURRENT_USER.id], mutedAt: new Date() })
    )

    await callDelete()

    const callData = (mockConversationUpdate as jest.Mock).mock.calls[0][0].data
    expect(callData.mutedAt).toBeNull()
  })

  it("preserves mutedAt when other users still have it muted", async () => {
    const existingDate = new Date("2025-04-01")
    mockConversationFindUnique.mockResolvedValue(
      makeConversation({
        mutedBy: [CURRENT_USER.id, "other-user-id"],
        mutedAt: existingDate,
        users: [CURRENT_USER, { id: "other-user-id", email: "other@example.com" }],
      })
    )

    await callDelete()

    const callData = (mockConversationUpdate as jest.Mock).mock.calls[0][0].data
    expect(callData.mutedAt).toEqual(existingDate)
  })

  it("triggers Pusher conversation:unmute event on the user channel", async () => {
    await callDelete()
    expect(mockPusherTrigger).toHaveBeenCalledWith(
      `private-user-${CURRENT_USER.id}`,
      "conversation:unmute",
      expect.anything()
    )
  })

  it("returns 500 when a database error occurs", async () => {
    mockConversationUpdate.mockRejectedValue(new Error("DB connection lost"))
    const res = await callDelete()
    expect(res.status).toBe(500)
  })
})

export {}
