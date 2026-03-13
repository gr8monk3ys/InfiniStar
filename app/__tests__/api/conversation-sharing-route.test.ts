/**
 * @jest-environment node
 */

/**
 * API Route Tests: Conversation Sharing
 *
 * Tests:
 *   POST /api/conversations/[conversationId]/share  — create a share
 *   GET  /api/conversations/[conversationId]/share  — list shares
 *   POST /api/share/[token]/join                    — join via token
 *
 * Both routes delegate heavy logic to app/lib/sharing.ts, which is mocked
 * entirely so tests focus on HTTP layer concerns (auth, CSRF, rate-limiting,
 * response shape) without hitting Prisma.
 */

import { NextRequest } from "next/server"

// ------------------------------------------------------------------
// Mock factories — declared before imports (Jest hoists jest.mock calls)
// ------------------------------------------------------------------

const mockAuth = jest.fn()
const mockVerifyCsrfToken = jest.fn()
const mockGetCsrfTokenFromRequest = jest.fn()
const mockCreateShareLink = jest.fn()
const mockGetSharesForConversation = jest.fn()
const mockJoinViaShare = jest.fn()
const mockConversationFindUnique = jest.fn()
const mockPusherTrigger = jest.fn()

jest.mock("@clerk/nextjs/server", () => ({
  auth: () => mockAuth(),
}))

jest.mock("@/app/lib/csrf", () => ({
  verifyCsrfToken: (...args: unknown[]) => mockVerifyCsrfToken(...args),
  getCsrfTokenFromRequest: (...args: unknown[]) => mockGetCsrfTokenFromRequest(...args),
}))

// The share routes import shareLimiter / shareJoinLimiter from @/app/lib/rate-limit.
// We mock the entire rate-limit module so it doesn't require Redis and all limiters
// always return true (allow). The factory uses plain objects (not jest.fn() calls
// at declaration scope) so Bun can hoist this correctly.
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

jest.mock("@/app/lib/sharing", () => ({
  createShareLink: (...args: unknown[]) => mockCreateShareLink(...args),
  getSharesForConversation: (...args: unknown[]) => mockGetSharesForConversation(...args),
  joinViaShare: (...args: unknown[]) => mockJoinViaShare(...args),
  getShareUrl: (token: string) => `http://localhost:3000/join/${token}`,
}))

jest.mock("@/app/lib/prismadb", () => ({
  __esModule: true,
  default: {
    conversation: {
      findUnique: (...args: unknown[]) => mockConversationFindUnique(...args),
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

// getCurrentUser wraps auth() + prisma; mock directly for simplicity
jest.mock("@/app/actions/getCurrentUser", () => ({
  __esModule: true,
  default: jest.fn(),
}))

// ------------------------------------------------------------------
// Fixtures
// ------------------------------------------------------------------

const CURRENT_USER = {
  id: "user-owner",
  email: "owner@example.com",
  name: "Owner",
}

const CONV_ID = "conv-abc"
const SHARE_TOKEN = "tok_secure_abc123"

const SAMPLE_SHARE = {
  id: "share-1",
  conversationId: CONV_ID,
  createdById: CURRENT_USER.id,
  shareToken: SHARE_TOKEN,
  shareType: "LINK",
  permission: "VIEW",
  expiresAt: null,
  maxUses: null,
  allowedEmails: [],
  name: null,
  isActive: true,
  useCount: 0,
  createdAt: new Date().toISOString(),
}

// ------------------------------------------------------------------
// Helpers
// ------------------------------------------------------------------

function makeShareCreateRequest(conversationId: string, body: unknown = {}): NextRequest {
  return new NextRequest(`http://localhost:3000/api/conversations/${conversationId}/share`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-CSRF-Token": "test-csrf",
      cookie: "csrf-token=test-csrf",
    },
    body: JSON.stringify(body),
  })
}

function makeShareGetRequest(conversationId: string): NextRequest {
  return new NextRequest(`http://localhost:3000/api/conversations/${conversationId}/share`, {
    method: "GET",
    headers: {
      "X-CSRF-Token": "test-csrf",
      cookie: "csrf-token=test-csrf",
    },
  })
}

function makeJoinRequest(token: string): NextRequest {
  return new NextRequest(`http://localhost:3000/api/share/${token}/join`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-CSRF-Token": "test-csrf",
      cookie: "csrf-token=test-csrf",
    },
  })
}

// ------------------------------------------------------------------
// Tests — Share creation route
// ------------------------------------------------------------------

describe("POST /api/conversations/[conversationId]/share", () => {
  let POST: (
    req: NextRequest,
    ctx: { params: Promise<{ conversationId: string }> }
  ) => Promise<Response>
  let getCurrentUser: jest.Mock

  beforeAll(async () => {
    const mod = await import("@/app/api/conversations/[conversationId]/share/route")
    POST = mod.POST
    const cuMod = await import("@/app/actions/getCurrentUser")
    getCurrentUser = cuMod.default as jest.Mock
  })

  beforeEach(() => {
    jest.clearAllMocks()
    mockVerifyCsrfToken.mockReturnValue(true)
    mockGetCsrfTokenFromRequest.mockReturnValue("test-csrf")
    getCurrentUser.mockResolvedValue(CURRENT_USER)
    mockCreateShareLink.mockResolvedValue({ success: true, share: SAMPLE_SHARE })
  })

  async function callCreate(convId: string, body: unknown) {
    const req = makeShareCreateRequest(convId, body)
    return POST(req, { params: Promise.resolve({ conversationId: convId }) })
  }

  it("returns 403 when CSRF token is invalid", async () => {
    mockVerifyCsrfToken.mockReturnValue(false)
    const res = await callCreate(CONV_ID, {})
    expect(res.status).toBe(403)
  })

  it("returns 401 when user is not authenticated", async () => {
    getCurrentUser.mockResolvedValue(null)
    const res = await callCreate(CONV_ID, {})
    expect(res.status).toBe(401)
  })

  it("creates a LINK share with default settings and returns share + URL", async () => {
    const res = await callCreate(CONV_ID, { shareType: "LINK" })
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.share).toBeDefined()
    expect(data.shareUrl).toContain(SHARE_TOKEN)
    expect(mockCreateShareLink).toHaveBeenCalledWith(
      CURRENT_USER.id,
      CONV_ID,
      expect.objectContaining({ shareType: "LINK" })
    )
  })

  it("creates an INVITE share with allowedEmails", async () => {
    const emails = ["friend@example.com", "another@example.com"]
    const res = await callCreate(CONV_ID, {
      shareType: "INVITE",
      allowedEmails: emails,
    })
    expect(res.status).toBe(200)
    expect(mockCreateShareLink).toHaveBeenCalledWith(
      CURRENT_USER.id,
      CONV_ID,
      expect.objectContaining({ shareType: "INVITE", allowedEmails: emails })
    )
  })

  it("returns 400 when shareType is INVITE but allowedEmails is empty", async () => {
    const res = await callCreate(CONV_ID, {
      shareType: "INVITE",
      allowedEmails: [],
    })
    expect(res.status).toBe(400)
    expect(mockCreateShareLink).not.toHaveBeenCalled()
  })

  it("passes maxUses through when provided", async () => {
    const res = await callCreate(CONV_ID, { maxUses: 5 })
    expect(res.status).toBe(200)
    expect(mockCreateShareLink).toHaveBeenCalledWith(
      CURRENT_USER.id,
      CONV_ID,
      expect.objectContaining({ maxUses: 5 })
    )
  })

  it("passes expiresAt through when provided as valid datetime string", async () => {
    const expiresAt = new Date(Date.now() + 86400 * 1000).toISOString()
    const res = await callCreate(CONV_ID, { expiresAt })
    expect(res.status).toBe(200)
    expect(mockCreateShareLink).toHaveBeenCalledWith(
      CURRENT_USER.id,
      CONV_ID,
      expect.objectContaining({ expiresAt: expect.any(Date) })
    )
  })

  it("returns 400 for an invalid shareType value", async () => {
    const res = await callCreate(CONV_ID, { shareType: "PUBLIC" })
    expect(res.status).toBe(400)
  })

  it("returns 403 when createShareLink reports the user is not a conversation participant", async () => {
    mockCreateShareLink.mockResolvedValue({
      success: false,
      error: "You are not part of this conversation",
    })
    const res = await callCreate(CONV_ID, {})
    expect(res.status).toBe(403)
  })

  it("returns 404 when createShareLink reports conversation not found", async () => {
    mockCreateShareLink.mockResolvedValue({
      success: false,
      error: "Conversation not found",
    })
    const res = await callCreate(CONV_ID, {})
    expect(res.status).toBe(404)
  })
})

// ------------------------------------------------------------------
// Tests — List shares (GET)
// ------------------------------------------------------------------

describe("GET /api/conversations/[conversationId]/share", () => {
  let GET: (
    req: NextRequest,
    ctx: { params: Promise<{ conversationId: string }> }
  ) => Promise<Response>
  let getCurrentUser: jest.Mock

  beforeAll(async () => {
    const mod = await import("@/app/api/conversations/[conversationId]/share/route")
    GET = mod.GET
    const cuMod = await import("@/app/actions/getCurrentUser")
    getCurrentUser = cuMod.default as jest.Mock
  })

  beforeEach(() => {
    jest.clearAllMocks()
    getCurrentUser.mockResolvedValue(CURRENT_USER)
    mockGetSharesForConversation.mockResolvedValue({
      success: true,
      shares: [SAMPLE_SHARE],
    })
  })

  async function callGet(convId: string) {
    const req = makeShareGetRequest(convId)
    return GET(req, { params: Promise.resolve({ conversationId: convId }) })
  }

  it("returns 401 when user is not authenticated", async () => {
    getCurrentUser.mockResolvedValue(null)
    const res = await callGet(CONV_ID)
    expect(res.status).toBe(401)
  })

  it("returns share list with URLs for authenticated conversation member", async () => {
    const res = await callGet(CONV_ID)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(Array.isArray(data.shares)).toBe(true)
    expect(data.shares[0].shareUrl).toContain(SHARE_TOKEN)
  })

  it("returns 403 when user is not a conversation participant", async () => {
    mockGetSharesForConversation.mockResolvedValue({
      success: false,
      error: "You are not part of this conversation",
    })
    const res = await callGet(CONV_ID)
    expect(res.status).toBe(403)
  })

  it("returns 404 when conversation does not exist", async () => {
    mockGetSharesForConversation.mockResolvedValue({
      success: false,
      error: "Conversation not found",
    })
    const res = await callGet(CONV_ID)
    expect(res.status).toBe(404)
  })
})

// ------------------------------------------------------------------
// Tests — Join via share token
// ------------------------------------------------------------------

describe("POST /api/share/[token]/join", () => {
  let POST: (req: NextRequest, ctx: { params: Promise<{ token: string }> }) => Promise<Response>
  let getCurrentUser: jest.Mock

  const JOINED_CONV = {
    id: CONV_ID,
    name: "Shared Room",
    users: [CURRENT_USER],
    messages: [],
  }

  beforeAll(async () => {
    const mod = await import("@/app/api/share/[token]/join/route")
    POST = mod.POST
    const cuMod = await import("@/app/actions/getCurrentUser")
    getCurrentUser = cuMod.default as jest.Mock
  })

  beforeEach(() => {
    jest.clearAllMocks()
    mockVerifyCsrfToken.mockReturnValue(true)
    mockGetCsrfTokenFromRequest.mockReturnValue("test-csrf")
    getCurrentUser.mockResolvedValue(CURRENT_USER)
    mockJoinViaShare.mockResolvedValue({
      success: true,
      conversationId: CONV_ID,
      permission: "VIEW",
    })
    mockConversationFindUnique.mockResolvedValue(JOINED_CONV)
    mockPusherTrigger.mockResolvedValue(undefined)
  })

  async function callJoin(token: string) {
    const req = makeJoinRequest(token)
    return POST(req, { params: Promise.resolve({ token }) })
  }

  it("returns 403 when CSRF token is invalid", async () => {
    mockVerifyCsrfToken.mockReturnValue(false)
    const res = await callJoin(SHARE_TOKEN)
    expect(res.status).toBe(403)
  })

  it("returns 401 when user is not authenticated", async () => {
    getCurrentUser.mockResolvedValue(null)
    const res = await callJoin(SHARE_TOKEN)
    expect(res.status).toBe(401)
  })

  it("joins conversation successfully for a valid token and returns conversationId", async () => {
    const res = await callJoin(SHARE_TOKEN)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.success).toBe(true)
    expect(data.conversationId).toBe(CONV_ID)
    expect(data.permission).toBe("VIEW")
  })

  it("calls joinViaShare with user id, email, and the token", async () => {
    await callJoin(SHARE_TOKEN)
    expect(mockJoinViaShare).toHaveBeenCalledWith(CURRENT_USER.id, CURRENT_USER.email, SHARE_TOKEN)
  })

  it("returns 403 when share token is invalid or not found", async () => {
    mockJoinViaShare.mockResolvedValue({
      success: false,
      error: "Share link not found",
    })
    const res = await callJoin("bad-token")
    expect(res.status).toBe(403)
  })

  it("returns 403 when share link has expired", async () => {
    mockJoinViaShare.mockResolvedValue({
      success: false,
      error: "This share link has expired",
    })
    const res = await callJoin(SHARE_TOKEN)
    expect(res.status).toBe(403)
    const data = await res.json()
    expect(data.error).toMatch(/expired/i)
  })

  it("returns 403 when share has reached its maximum uses", async () => {
    mockJoinViaShare.mockResolvedValue({
      success: false,
      error: "This share link has reached its maximum uses",
    })
    const res = await callJoin(SHARE_TOKEN)
    expect(res.status).toBe(403)
  })

  it("returns 403 when user email is not on the invite allowlist", async () => {
    mockJoinViaShare.mockResolvedValue({
      success: false,
      error: "You are not invited to this conversation",
    })
    const res = await callJoin(SHARE_TOKEN)
    expect(res.status).toBe(403)
    const data = await res.json()
    expect(data.error).toMatch(/invited/i)
  })

  it("succeeds without duplicate membership when user is already in conversation", async () => {
    // joinViaShare returns success: true when user is already a member
    mockJoinViaShare.mockResolvedValue({
      success: true,
      conversationId: CONV_ID,
      permission: "VIEW",
    })
    const res = await callJoin(SHARE_TOKEN)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.success).toBe(true)
  })

  it("triggers Pusher conversation:update for other members after joining", async () => {
    // Conversation has two users; the current user and another
    const otherUser = { id: "user-other", name: "Other" }
    mockConversationFindUnique.mockResolvedValue({
      ...JOINED_CONV,
      users: [CURRENT_USER, otherUser],
    })

    await callJoin(SHARE_TOKEN)

    expect(mockPusherTrigger).toHaveBeenCalledWith(
      `private-user-${otherUser.id}`,
      "conversation:update",
      expect.anything()
    )
    // Should NOT notify the joining user themselves
    expect(mockPusherTrigger).not.toHaveBeenCalledWith(
      `private-user-${CURRENT_USER.id}`,
      "conversation:update",
      expect.anything()
    )
  })

  it("returns 500 when joinViaShare throws unexpectedly", async () => {
    mockJoinViaShare.mockRejectedValue(new Error("Unexpected DB error"))
    const res = await callJoin(SHARE_TOKEN)
    expect(res.status).toBe(500)
  })
})

export {}
