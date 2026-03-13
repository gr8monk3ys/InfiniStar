/**
 * @jest-environment node
 */

/**
 * API Route Tests: Conversation Pin
 *
 * Tests POST /api/conversations/[id]/pin and
 *       DELETE /api/conversations/[id]/pin
 */

import { NextRequest } from "next/server"

// ------------------------------------------------------------------
// Mock factories
// ------------------------------------------------------------------

const mockVerifyCsrfToken = jest.fn()
const mockGetCsrfTokenFromRequest = jest.fn()
const mockConversationFindUnique = jest.fn()
const mockConversationUpdate = jest.fn()
const mockConversationCount = jest.fn()
const mockPusherTrigger = jest.fn()
const mockTransactionFn = jest.fn()

jest.mock("@/app/lib/csrf", () => ({
  verifyCsrfToken: (...args: unknown[]) => mockVerifyCsrfToken(...args),
  getCsrfTokenFromRequest: (...args: unknown[]) => mockGetCsrfTokenFromRequest(...args),
}))

// The pin route uses prisma.$transaction internally. We provide a mock that
// invokes the callback with a tx proxy exposing the operations we need.
jest.mock("@/app/lib/prismadb", () => ({
  __esModule: true,
  default: {
    conversation: {
      findUnique: (...args: unknown[]) => mockConversationFindUnique(...args),
      update: (...args: unknown[]) => mockConversationUpdate(...args),
      count: (...args: unknown[]) => mockConversationCount(...args),
    },
    $transaction: (fn: (tx: unknown) => Promise<unknown>) => mockTransactionFn(fn),
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
  id: "user-11111111-1111-4111-8111-111111111111",
  email: "alice@example.com",
  name: "Alice",
}

const CONV_ID = "conv-33333333-3333-4333-8333-333333333333"

function makeConversation(overrides: Record<string, unknown> = {}) {
  return {
    id: CONV_ID,
    name: "Test Conversation",
    pinnedBy: [],
    pinnedAt: null,
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
// Transaction helper
//
// The pin route runs a $transaction. We simulate this by executing the
// callback directly with a minimal tx object that delegates to our mocks.
// ------------------------------------------------------------------

function setupTransactionSuccess(pinnedCount: number, updatedConv: unknown) {
  mockTransactionFn.mockImplementation((fn: (tx: unknown) => Promise<unknown>) => {
    const tx = {
      conversation: {
        count: () => Promise.resolve(pinnedCount),
        update: (...args: unknown[]) => mockConversationUpdate(...args),
      },
    }
    return fn(tx)
  })
  mockConversationUpdate.mockResolvedValue(updatedConv)
}

function setupTransactionMaxPins() {
  mockTransactionFn.mockImplementation((fn: (tx: unknown) => Promise<unknown>) => {
    const tx = {
      conversation: {
        count: () => Promise.resolve(5),
        update: jest.fn(),
      },
    }
    return fn(tx)
  })
}

// ------------------------------------------------------------------
// Helpers
// ------------------------------------------------------------------

function makeRequest(method: "POST" | "DELETE"): NextRequest {
  return new NextRequest(`http://localhost:3000/api/conversations/${CONV_ID}/pin`, {
    method,
    headers: {
      "Content-Type": "application/json",
      "X-CSRF-Token": "test-csrf",
      cookie: "csrf-token=test-csrf",
    },
  })
}

// ------------------------------------------------------------------
// Tests — POST (pin)
// ------------------------------------------------------------------

describe("POST /api/conversations/[conversationId]/pin", () => {
  let POST: (
    req: NextRequest,
    ctx: { params: Promise<{ conversationId: string }> }
  ) => Promise<Response>
  let getCurrentUser: jest.Mock

  beforeAll(async () => {
    const mod = await import("@/app/api/conversations/[conversationId]/pin/route")
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
    setupTransactionSuccess(
      0,
      makeUpdatedConversation({ pinnedBy: [CURRENT_USER.id], pinnedAt: new Date() })
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
  })

  it("pins the conversation and returns the updated conversation", async () => {
    const res = await callPost()
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.id).toBe(CONV_ID)
    expect(mockConversationUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: CONV_ID },
        data: expect.objectContaining({
          pinnedBy: [CURRENT_USER.id],
        }),
      })
    )
  })

  it("returns 400 when conversation is already pinned by this user", async () => {
    mockConversationFindUnique.mockResolvedValue(makeConversation({ pinnedBy: [CURRENT_USER.id] }))
    const res = await callPost()
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toMatch(/already pinned/i)
    expect(mockTransactionFn).not.toHaveBeenCalled()
  })

  it("returns 400 when user already has 5 pinned conversations", async () => {
    setupTransactionMaxPins()
    const res = await callPost()
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toMatch(/5 conversations/i)
  })

  it("triggers Pusher conversation:pin event on the user channel", async () => {
    await callPost()
    expect(mockPusherTrigger).toHaveBeenCalledWith(
      `private-user-${CURRENT_USER.id}`,
      "conversation:pin",
      expect.anything()
    )
  })

  it("sets pinnedAt when first user pins the conversation", async () => {
    mockConversationFindUnique.mockResolvedValue(makeConversation({ pinnedBy: [] }))
    setupTransactionSuccess(
      0,
      makeUpdatedConversation({ pinnedBy: [CURRENT_USER.id], pinnedAt: new Date() })
    )

    await callPost()

    const callData = (mockConversationUpdate as jest.Mock).mock.calls[0][0].data
    expect(callData.pinnedAt).toBeInstanceOf(Date)
  })

  it("preserves existing pinnedAt when a second user pins", async () => {
    const existingDate = new Date("2025-03-01")
    mockConversationFindUnique.mockResolvedValue(
      makeConversation({
        pinnedBy: ["other-user-id"],
        pinnedAt: existingDate,
        users: [CURRENT_USER, { id: "other-user-id", email: "other@example.com" }],
      })
    )
    setupTransactionSuccess(
      1,
      makeUpdatedConversation({
        pinnedBy: ["other-user-id", CURRENT_USER.id],
        pinnedAt: existingDate,
      })
    )

    await callPost()

    const callData = (mockConversationUpdate as jest.Mock).mock.calls[0][0].data
    expect(callData.pinnedAt).toEqual(existingDate)
  })
})

// ------------------------------------------------------------------
// Tests — DELETE (unpin)
// ------------------------------------------------------------------

describe("DELETE /api/conversations/[conversationId]/pin", () => {
  let DELETE: (
    req: NextRequest,
    ctx: { params: Promise<{ conversationId: string }> }
  ) => Promise<Response>
  let getCurrentUser: jest.Mock

  beforeAll(async () => {
    const mod = await import("@/app/api/conversations/[conversationId]/pin/route")
    DELETE = mod.DELETE
    const cuMod = await import("@/app/actions/getCurrentUser")
    getCurrentUser = cuMod.default as jest.Mock
  })

  beforeEach(() => {
    jest.clearAllMocks()
    mockVerifyCsrfToken.mockReturnValue(true)
    mockGetCsrfTokenFromRequest.mockReturnValue("test-csrf")
    getCurrentUser.mockResolvedValue(CURRENT_USER)
    // Conversation is pinned by the current user
    mockConversationFindUnique.mockResolvedValue(
      makeConversation({ pinnedBy: [CURRENT_USER.id], pinnedAt: new Date() })
    )
    mockConversationUpdate.mockResolvedValue(
      makeUpdatedConversation({ pinnedBy: [], pinnedAt: null })
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
        pinnedBy: [CURRENT_USER.id],
        users: [{ id: "other-user", email: "other@example.com" }],
      })
    )
    const res = await callDelete()
    expect(res.status).toBe(403)
  })

  it("returns 400 when conversation is not pinned by this user", async () => {
    mockConversationFindUnique.mockResolvedValue(makeConversation({ pinnedBy: [] }))
    const res = await callDelete()
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toMatch(/not pinned/i)
  })

  it("unpins the conversation and returns updated conversation", async () => {
    const res = await callDelete()
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.id).toBe(CONV_ID)
    expect(mockConversationUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: CONV_ID },
        data: expect.objectContaining({
          pinnedBy: [],
        }),
      })
    )
  })

  it("clears pinnedAt when the last user unpins", async () => {
    mockConversationFindUnique.mockResolvedValue(
      makeConversation({ pinnedBy: [CURRENT_USER.id], pinnedAt: new Date() })
    )

    await callDelete()

    const callData = (mockConversationUpdate as jest.Mock).mock.calls[0][0].data
    expect(callData.pinnedAt).toBeNull()
  })

  it("preserves pinnedAt when other users still have it pinned", async () => {
    const existingDate = new Date("2025-02-01")
    mockConversationFindUnique.mockResolvedValue(
      makeConversation({
        pinnedBy: [CURRENT_USER.id, "other-user-id"],
        pinnedAt: existingDate,
        users: [CURRENT_USER, { id: "other-user-id", email: "other@example.com" }],
      })
    )

    await callDelete()

    const callData = (mockConversationUpdate as jest.Mock).mock.calls[0][0].data
    expect(callData.pinnedAt).toEqual(existingDate)
  })

  it("triggers Pusher conversation:unpin event on the user channel", async () => {
    await callDelete()
    expect(mockPusherTrigger).toHaveBeenCalledWith(
      `private-user-${CURRENT_USER.id}`,
      "conversation:unpin",
      expect.anything()
    )
  })
})

export {}
