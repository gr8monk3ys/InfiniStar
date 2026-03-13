/**
 * @jest-environment node
 */

/**
 * API Route Tests: Message Reactions
 *
 * Tests POST /api/messages/[messageId]/react
 *
 * The route:
 * 1. Validates CSRF token
 * 2. Requires authentication via getCurrentUser (which wraps auth() + prisma lookup)
 * 3. Validates emoji body via Zod
 * 4. Finds the message and checks it is not deleted
 * 5. Toggles the reaction (add if absent, remove if present)
 * 6. Persists via prisma.message.update
 * 7. Triggers a Pusher "message:reaction" event on the conversation channel
 */

import { NextRequest } from "next/server"

// ------------------------------------------------------------------
// Mock declarations — hoisted before any imports by Jest
// ------------------------------------------------------------------

const mockAuth = jest.fn()
const mockVerifyCsrfToken = jest.fn()
const mockGetCsrfTokenFromRequest = jest.fn()
const mockMessageFindUnique = jest.fn()
const mockMessageUpdate = jest.fn()
const mockUserFindUnique = jest.fn()
const mockPusherTrigger = jest.fn()

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
    message: {
      findUnique: (...args: unknown[]) => mockMessageFindUnique(...args),
      update: (...args: unknown[]) => mockMessageUpdate(...args),
    },
  },
}))

jest.mock("@/app/lib/pusher-server", () => ({
  pusherServer: {
    trigger: (...args: unknown[]) => mockPusherTrigger(...args),
  },
}))

jest.mock("@/app/lib/pusher-channels", () => ({
  getPusherConversationChannel: (id: string) => `private-conversation-${id}`,
  getPusherUserChannel: (id: string) => `private-user-${id}`,
  PUSHER_PRESENCE_CHANNEL: "presence-messenger",
}))

// getCurrentUser calls auth() then prisma.user.findUnique internally.
// We mock it directly so tests only need to control one place.
jest.mock("@/app/actions/getCurrentUser", () => ({
  __esModule: true,
  default: jest.fn(),
}))

// ------------------------------------------------------------------
// Helpers
// ------------------------------------------------------------------

function makeRequest(messageId: string, body?: unknown): NextRequest {
  return new NextRequest(`http://localhost:3000/api/messages/${messageId}/react`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-CSRF-Token": "test-csrf-token",
      cookie: "csrf-token=test-csrf-token",
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
}

const TEST_USER = {
  id: "user-1",
  email: "user@example.com",
  name: "Test User",
}

const TEST_MESSAGE = {
  id: "msg-1",
  conversationId: "conv-1",
  body: "Hello",
  isDeleted: false,
  reactions: {},
  sender: TEST_USER,
  seen: [],
}

// ------------------------------------------------------------------
// Tests
// ------------------------------------------------------------------

describe("POST /api/messages/[messageId]/react", () => {
  // Import after mocks are set up
  let POST: (req: NextRequest, ctx: { params: Promise<{ messageId: string }> }) => Promise<Response>
  let getCurrentUser: jest.Mock

  beforeAll(async () => {
    const mod = await import("@/app/api/messages/[messageId]/react/route")
    POST = mod.POST
    const getCurrentUserMod = await import("@/app/actions/getCurrentUser")
    getCurrentUser = getCurrentUserMod.default as jest.Mock
  })

  beforeEach(() => {
    jest.clearAllMocks()
    mockAuth.mockResolvedValue({ userId: "clerk_abc" })
    mockVerifyCsrfToken.mockReturnValue(true)
    mockGetCsrfTokenFromRequest.mockReturnValue("test-csrf-token")
    getCurrentUser.mockResolvedValue(TEST_USER)
    mockMessageFindUnique.mockResolvedValue({ ...TEST_MESSAGE })
    mockMessageUpdate.mockImplementation(({ data }: { data: { reactions: unknown } }) =>
      Promise.resolve({ ...TEST_MESSAGE, reactions: data.reactions })
    )
    mockPusherTrigger.mockResolvedValue(undefined)
  })

  // Helper to call the route handler
  async function callReact(messageId: string, body: unknown) {
    const req = makeRequest(messageId, body)
    return POST(req, { params: Promise.resolve({ messageId }) })
  }

  // ------------------------------------------------------------------
  // Guard clauses
  // ------------------------------------------------------------------

  describe("Guard clauses", () => {
    it("returns 403 when CSRF token is invalid", async () => {
      mockVerifyCsrfToken.mockReturnValue(false)
      const res = await callReact("msg-1", { emoji: "👍" })
      expect(res.status).toBe(403)
      const data = await res.json()
      expect(data.error).toMatch(/csrf/i)
    })

    it("returns 401 when user is not authenticated", async () => {
      getCurrentUser.mockResolvedValue(null)
      const res = await callReact("msg-1", { emoji: "👍" })
      expect(res.status).toBe(401)
      const data = await res.json()
      expect(data.error).toMatch(/unauthorized/i)
    })

    it("returns 400 for missing emoji in request body", async () => {
      const res = await callReact("msg-1", {})
      expect(res.status).toBe(400)
    })

    it("returns 400 for empty string emoji", async () => {
      const res = await callReact("msg-1", { emoji: "" })
      expect(res.status).toBe(400)
    })

    it("returns 404 when message does not exist", async () => {
      mockMessageFindUnique.mockResolvedValue(null)
      const res = await callReact("msg-missing", { emoji: "👍" })
      expect(res.status).toBe(404)
      const data = await res.json()
      expect(data.error).toMatch(/not found/i)
    })

    it("returns 400 when trying to react to a deleted message", async () => {
      mockMessageFindUnique.mockResolvedValue({ ...TEST_MESSAGE, isDeleted: true })
      const res = await callReact("msg-1", { emoji: "👍" })
      expect(res.status).toBe(400)
      const data = await res.json()
      expect(data.error).toMatch(/deleted/i)
    })
  })

  // ------------------------------------------------------------------
  // Reaction logic
  // ------------------------------------------------------------------

  describe("Reaction toggle logic", () => {
    it("adds a new reaction when the user has not yet reacted with that emoji", async () => {
      mockMessageFindUnique.mockResolvedValue({
        ...TEST_MESSAGE,
        reactions: {},
      })

      const res = await callReact("msg-1", { emoji: "👍" })
      expect(res.status).toBe(200)

      expect(mockMessageUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            reactions: expect.objectContaining({ "👍": ["user-1"] }),
          }),
        })
      )
    })

    it("removes an existing reaction when the same user reacts again with the same emoji", async () => {
      // User-1 already reacted with 👍
      mockMessageFindUnique.mockResolvedValue({
        ...TEST_MESSAGE,
        reactions: { "👍": ["user-1"] },
      })

      const res = await callReact("msg-1", { emoji: "👍" })
      expect(res.status).toBe(200)

      const call = mockMessageUpdate.mock.calls[0][0]
      // The reactions object should have no entry for 👍 after removal
      const reactions = call.data.reactions as Record<string, string[]>
      expect(reactions["👍"]).toBeUndefined()
    })

    it("adds a second user to an existing emoji reaction array", async () => {
      // User-2 already reacted; now user-1 reacts with the same emoji
      mockMessageFindUnique.mockResolvedValue({
        ...TEST_MESSAGE,
        reactions: { "👍": ["user-2"] },
      })

      const res = await callReact("msg-1", { emoji: "👍" })
      expect(res.status).toBe(200)

      const call = mockMessageUpdate.mock.calls[0][0]
      const reactions = call.data.reactions as Record<string, string[]>
      expect(reactions["👍"]).toContain("user-1")
      expect(reactions["👍"]).toContain("user-2")
    })

    it("removes the emoji key entirely when the last reactor un-reacts", async () => {
      mockMessageFindUnique.mockResolvedValue({
        ...TEST_MESSAGE,
        reactions: { "👍": ["user-1"] },
      })

      const res = await callReact("msg-1", { emoji: "👍" })
      expect(res.status).toBe(200)

      const call = mockMessageUpdate.mock.calls[0][0]
      const reactions = call.data.reactions as Record<string, string[]>
      // Key should be gone, not just an empty array
      expect(Object.keys(reactions)).not.toContain("👍")
    })

    it("handles a message that has no existing reactions (null reactions field)", async () => {
      mockMessageFindUnique.mockResolvedValue({
        ...TEST_MESSAGE,
        reactions: null,
      })

      const res = await callReact("msg-1", { emoji: "🔥" })
      expect(res.status).toBe(200)

      const call = mockMessageUpdate.mock.calls[0][0]
      const reactions = call.data.reactions as Record<string, string[]>
      expect(reactions["🔥"]).toContain("user-1")
    })
  })

  // ------------------------------------------------------------------
  // Pusher
  // ------------------------------------------------------------------

  describe("Pusher event", () => {
    it("triggers message:reaction on the conversation's Pusher channel after a successful reaction", async () => {
      const updatedMessage = { ...TEST_MESSAGE, reactions: { "👍": ["user-1"] } }
      mockMessageUpdate.mockResolvedValue(updatedMessage)

      await callReact("msg-1", { emoji: "👍" })

      expect(mockPusherTrigger).toHaveBeenCalledWith(
        "private-conversation-conv-1",
        "message:reaction",
        updatedMessage
      )
    })

    it("does not trigger Pusher when CSRF check fails", async () => {
      mockVerifyCsrfToken.mockReturnValue(false)
      await callReact("msg-1", { emoji: "👍" })
      expect(mockPusherTrigger).not.toHaveBeenCalled()
    })
  })

  // ------------------------------------------------------------------
  // Error handling
  // ------------------------------------------------------------------

  describe("Error handling", () => {
    it("returns 500 when the database message lookup throws", async () => {
      mockMessageFindUnique.mockRejectedValue(new Error("DB error"))
      const res = await callReact("msg-1", { emoji: "👍" })
      expect(res.status).toBe(500)
    })

    it("returns 500 when the database update throws", async () => {
      mockMessageUpdate.mockRejectedValue(new Error("DB write error"))
      const res = await callReact("msg-1", { emoji: "👍" })
      expect(res.status).toBe(500)
    })
  })
})

export {}
