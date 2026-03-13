/**
 * @jest-environment node
 */

/**
 * API Route Tests: AI Regenerate
 *
 * Tests POST /api/ai/regenerate
 */

import { NextRequest } from "next/server"

import { POST } from "@/app/api/ai/regenerate/route"

const mockGetCurrentUser = jest.fn()
const mockMessageFindUnique = jest.fn()
const mockMessageFindMany = jest.fn()
const mockConversationUpdate = jest.fn()
const mockPusherTrigger = jest.fn()
const mockVerifyCsrfToken = jest.fn()
const mockAiChatLimiterCheck = jest.fn()
const mockGetAiAccessDecision = jest.fn()
const mockTrackAiUsage = jest.fn()
const mockAnthropicStream = jest.fn()
const mockBuildAiConversationHistory = jest.fn()
const mockTxMessageUpdate = jest.fn()
const mockTxConversationUpdate = jest.fn()

jest.mock("@/app/actions/getCurrentUser", () => ({
  __esModule: true,
  default: () => mockGetCurrentUser(),
}))

jest.mock("@/app/lib/prismadb", () => ({
  __esModule: true,
  default: {
    message: {
      findUnique: (args: unknown) => mockMessageFindUnique(args),
      findMany: (args: unknown) => mockMessageFindMany(args),
    },
    conversation: {
      update: (args: unknown) => mockConversationUpdate(args),
    },
    $transaction: jest.fn((cb: (tx: unknown) => unknown) =>
      cb({
        message: { update: (args: unknown) => mockTxMessageUpdate(args) },
        conversation: { update: (args: unknown) => mockTxConversationUpdate(args) },
      })
    ),
  },
}))

jest.mock("@/app/lib/pusher-server", () => ({
  pusherServer: { trigger: (...args: unknown[]) => mockPusherTrigger(...args) },
}))

jest.mock("@/app/lib/pusher-channels", () => ({
  PUSHER_PRESENCE_CHANNEL: "presence-messenger",
  getPusherUserChannel: (id: string) => `private-user-${id}`,
  getPusherConversationChannel: (id: string) => `private-conversation-${id}`,
}))

jest.mock("@/app/lib/csrf", () => ({
  verifyCsrfToken: (...args: unknown[]) => mockVerifyCsrfToken(...args),
  getCsrfTokenFromRequest: () => "test-token",
}))

jest.mock("@/app/lib/rate-limit", () => ({
  aiChatLimiter: { check: () => mockAiChatLimiterCheck() },
  getClientIdentifier: () => "127.0.0.1",
}))

jest.mock("@/app/lib/ai-access", () => ({
  getAiAccessDecision: (userId: string) => mockGetAiAccessDecision(userId),
}))

jest.mock("@/app/lib/ai-usage", () => ({
  trackAiUsage: (...args: unknown[]) => mockTrackAiUsage(...args),
}))

jest.mock("@/app/lib/ai-message-content", () => ({
  buildAiConversationHistory: (...args: unknown[]) => mockBuildAiConversationHistory(...args),
}))

jest.mock("@/app/lib/ai-model-routing", () => ({
  getModelForUser: () => "claude-sonnet-4-5-20250929",
}))

jest.mock("@/app/lib/ai-personalities", () => ({
  isValidPersonality: () => true,
  getDefaultPersonality: () => "assistant",
  getSystemPrompt: () => "You are a helpful assistant.",
}))

jest.mock("@/app/lib/anthropic", () => ({
  __esModule: true,
  default: {
    messages: {
      stream: (...args: unknown[]) => mockAnthropicStream(...args),
    },
  },
}))

function createRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest("http://localhost:3000/api/ai/regenerate", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-CSRF-Token": "test-token",
      cookie: "csrf-token=test-token",
    },
    body: JSON.stringify(body),
  })
}

async function readStreamToString(response: Response): Promise<string> {
  const streamBody = response.body
  if (!streamBody) {
    return ""
  }

  const reader = streamBody.getReader()
  const decoder = new TextDecoder()
  let result = ""
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    result += decoder.decode(value, { stream: true })
  }
  return result
}

function buildFakeStream(chunks: unknown[]) {
  return {
    [Symbol.asyncIterator]: async function* () {
      for (const chunk of chunks) {
        yield chunk
      }
    },
    finalMessage: jest.fn().mockResolvedValue({
      usage: { input_tokens: 10, output_tokens: 30 },
    }),
  }
}

const testUser = { id: "user-1", email: "test@example.com" }

const testConversation = {
  id: "conv-1",
  isAI: true,
  aiModel: null,
  aiPersonality: "assistant",
  aiSystemPrompt: null,
  users: [testUser],
}

const testAiMessage = {
  id: "msg-ai-1",
  body: "Original AI response",
  conversationId: "conv-1",
  senderId: "user-1",
  isAI: true,
  isDeleted: false,
  createdAt: new Date("2024-01-01T10:00:00Z"),
  variants: [],
  conversation: testConversation,
  sender: testUser,
  seen: [testUser],
}

const updatedAiMessage = {
  ...testAiMessage,
  body: "Regenerated AI response",
  variants: ["Original AI response", "Regenerated AI response"],
  activeVariant: 1,
  inputTokens: 10,
  outputTokens: 30,
}

beforeEach(() => {
  jest.clearAllMocks()
  mockVerifyCsrfToken.mockReturnValue(true)
  mockAiChatLimiterCheck.mockReturnValue(true)
  mockGetCurrentUser.mockResolvedValue(testUser)
  mockMessageFindUnique.mockResolvedValue(testAiMessage)
  mockMessageFindMany.mockResolvedValue([])
  mockTxMessageUpdate.mockResolvedValue(updatedAiMessage)
  mockTxConversationUpdate.mockResolvedValue({ id: "conv-1" })
  mockConversationUpdate.mockResolvedValue({ id: "conv-1" })
  mockPusherTrigger.mockResolvedValue(undefined)
  mockGetAiAccessDecision.mockResolvedValue({
    allowed: true,
    limits: { isPro: false, monthlyMessageCount: 1, monthlyMessageLimit: 10 },
  })
  mockTrackAiUsage.mockResolvedValue(undefined)
  mockAnthropicStream.mockReturnValue(
    buildFakeStream([
      { type: "content_block_delta", delta: { type: "text_delta", text: "Regenerated " } },
      { type: "content_block_delta", delta: { type: "text_delta", text: "AI response" } },
    ])
  )
  mockBuildAiConversationHistory.mockReturnValue([])
})

describe("POST /api/ai/regenerate", () => {
  it("returns 403 when CSRF token is invalid", async () => {
    mockVerifyCsrfToken.mockReturnValue(false)
    const response = await POST(createRequest({ messageId: "msg-ai-1" }))
    expect(response.status).toBe(403)
    const data = await response.json()
    expect(data.code).toBe("CSRF_TOKEN_INVALID")
  })

  it("returns 429 when rate limit is exceeded", async () => {
    mockAiChatLimiterCheck.mockReturnValue(false)
    const response = await POST(createRequest({ messageId: "msg-ai-1" }))
    expect(response.status).toBe(429)
    expect(response.headers.get("Retry-After")).toBe("60")
  })

  it("returns 401 when user is not authenticated", async () => {
    mockGetCurrentUser.mockResolvedValue(null)
    const response = await POST(createRequest({ messageId: "msg-ai-1" }))
    expect(response.status).toBe(401)
  })

  it("returns 401 when authenticated user has no email", async () => {
    mockGetCurrentUser.mockResolvedValue({ id: "user-1" })
    const response = await POST(createRequest({ messageId: "msg-ai-1" }))
    expect(response.status).toBe(401)
  })

  it("returns 415 when Content-Type is not application/json", async () => {
    const request = new NextRequest("http://localhost:3000/api/ai/regenerate", {
      method: "POST",
      headers: {
        "Content-Type": "text/plain",
        "X-CSRF-Token": "test-token",
        cookie: "csrf-token=test-token",
      },
      body: JSON.stringify({ messageId: "msg-ai-1" }),
    })
    const response = await POST(request)
    expect(response.status).toBe(415)
  })

  it("returns 400 when messageId is missing", async () => {
    const response = await POST(createRequest({}))
    expect(response.status).toBe(400)
  })

  it("returns 400 when messageId is an empty string", async () => {
    const response = await POST(createRequest({ messageId: "" }))
    expect(response.status).toBe(400)
  })

  it("returns 404 when message is not found", async () => {
    mockMessageFindUnique.mockResolvedValue(null)
    const response = await POST(createRequest({ messageId: "msg-nonexistent" }))
    expect(response.status).toBe(404)
    const data = await response.json()
    expect(data.error).toContain("not found")
  })

  it("returns 400 when message is not an AI message", async () => {
    mockMessageFindUnique.mockResolvedValue({ ...testAiMessage, isAI: false })
    const response = await POST(createRequest({ messageId: "msg-ai-1" }))
    expect(response.status).toBe(400)
    const data = await response.json()
    expect(data.error).toContain("AI messages")
  })

  it("returns 400 when conversation is not an AI conversation", async () => {
    mockMessageFindUnique.mockResolvedValue({
      ...testAiMessage,
      conversation: { ...testConversation, isAI: false },
    })
    const response = await POST(createRequest({ messageId: "msg-ai-1" }))
    expect(response.status).toBe(400)
    const data = await response.json()
    expect(data.error).toContain("AI conversation")
  })

  it("returns 403 when user is not part of the conversation", async () => {
    mockMessageFindUnique.mockResolvedValue({
      ...testAiMessage,
      conversation: {
        ...testConversation,
        users: [{ id: "other-user" }],
      },
    })
    const response = await POST(createRequest({ messageId: "msg-ai-1" }))
    expect(response.status).toBe(403)
    const data = await response.json()
    expect(data.error).toContain("not part of this conversation")
  })

  it("returns 402 when free tier message limit is exceeded", async () => {
    mockGetAiAccessDecision.mockResolvedValue({
      allowed: false,
      code: "FREE_TIER_MESSAGE_LIMIT_REACHED",
      message: "Limit reached",
      limits: { isPro: false, monthlyMessageCount: 10, monthlyMessageLimit: 10 },
    })
    const response = await POST(createRequest({ messageId: "msg-ai-1" }))
    expect(response.status).toBe(402)
    const data = await response.json()
    expect(data.code).toBe("FREE_TIER_MESSAGE_LIMIT_REACHED")
  })

  it("returns 200 with text/event-stream content-type for a valid request", async () => {
    const response = await POST(createRequest({ messageId: "msg-ai-1" }))
    expect(response.status).toBe(200)
    expect(response.headers.get("Content-Type")).toBe("text/event-stream")
  })

  it("includes Cache-Control and Connection SSE headers", async () => {
    const response = await POST(createRequest({ messageId: "msg-ai-1" }))
    expect(response.headers.get("Cache-Control")).toBe("no-cache, no-transform")
    expect(response.headers.get("Connection")).toBe("keep-alive")
  })

  it("streams SSE chunk events with regenerated text", async () => {
    const response = await POST(createRequest({ messageId: "msg-ai-1" }))
    const body = await readStreamToString(response)
    expect(body).toContain("Regenerated ")
    expect(body).toContain("AI response")
  })

  it("sends a done event at stream end with messageId", async () => {
    const response = await POST(createRequest({ messageId: "msg-ai-1" }))
    const body = await readStreamToString(response)
    expect(body).toContain('"type":"done"')
    expect(body).toContain('"messageId"')
  })

  it("updates the existing AI message in the database instead of creating a new one", async () => {
    const response = await POST(createRequest({ messageId: "msg-ai-1" }))
    await readStreamToString(response)
    expect(mockTxMessageUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "msg-ai-1" },
        data: expect.objectContaining({ body: expect.any(String), isDeleted: false }),
      })
    )
  })

  it("backfills the original body as the first variant on first regeneration", async () => {
    const response = await POST(createRequest({ messageId: "msg-ai-1" }))
    await readStreamToString(response)
    expect(mockTxMessageUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          variants: ["Original AI response", expect.any(String)],
        }),
      })
    )
  })

  it("appends to existing variants on subsequent regenerations", async () => {
    mockMessageFindUnique.mockResolvedValue({
      ...testAiMessage,
      body: "Second response",
      variants: ["First response", "Second response"],
    })
    const response = await POST(createRequest({ messageId: "msg-ai-1" }))
    await readStreamToString(response)
    expect(mockTxMessageUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          variants: ["First response", "Second response", expect.any(String)],
        }),
      })
    )
  })

  it("triggers Pusher message:update event after regeneration completes", async () => {
    const response = await POST(createRequest({ messageId: "msg-ai-1" }))
    await readStreamToString(response)
    expect(mockPusherTrigger).toHaveBeenCalledWith(
      "private-conversation-conv-1",
      "message:update",
      expect.objectContaining({ id: "msg-ai-1" })
    )
  })

  it("calls trackAiUsage with correct parameters", async () => {
    const response = await POST(createRequest({ messageId: "msg-ai-1" }))
    await readStreamToString(response)
    expect(mockTrackAiUsage).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-1",
        conversationId: "conv-1",
        inputTokens: 10,
        outputTokens: 30,
        requestType: "chat-stream",
      })
    )
  })

  it("sends an SSE error event when Anthropic stream throws mid-stream", async () => {
    mockAnthropicStream.mockReturnValue({
      [Symbol.asyncIterator]: async function* () {
        if (Date.now() < 0) {
          yield null
        }
        throw new Error("Stream failure")
      },
      finalMessage: jest.fn().mockResolvedValue({ usage: { input_tokens: 5, output_tokens: 3 } }),
    })
    const response = await POST(createRequest({ messageId: "msg-ai-1" }))
    expect(response.status).toBe(200)
    const body = await readStreamToString(response)
    expect(body).toContain('"type":"error"')
  })

  it("returns 500 on unexpected outer error before streaming starts", async () => {
    mockMessageFindUnique.mockRejectedValue(new Error("DB crashed"))
    const response = await POST(createRequest({ messageId: "msg-ai-1" }))
    expect(response.status).toBe(500)
  })
})

export {}
