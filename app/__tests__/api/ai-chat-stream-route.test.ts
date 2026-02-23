/**
 * @jest-environment node
 */

/**
 * API Route Tests: AI Chat Stream (SSE)
 *
 * Tests POST /api/ai/chat-stream
 */

import { NextRequest } from "next/server"

import { POST } from "@/app/api/ai/chat-stream/route"

const mockGetCurrentUser = jest.fn()
const mockConversationFindFirst = jest.fn()
const mockMessageCreate = jest.fn()
const mockConversationUpdate = jest.fn()
const mockUserFindUnique = jest.fn()
const mockContentReportCreate = jest.fn()
const mockPusherTrigger = jest.fn()
const mockVerifyCsrfToken = jest.fn()
const mockAiChatLimiterCheck = jest.fn()
const mockGetAiAccessDecision = jest.fn()
const mockTrackAiUsage = jest.fn()
const mockModerateText = jest.fn()
const mockAnthropicStream = jest.fn()
const mockBuildAiConversationHistory = jest.fn()
const mockBuildAiMessageContent = jest.fn()
const mockSendWebPush = jest.fn()
const mockGetRelevantMemories = jest.fn()
const mockBuildMemoryContext = jest.fn()

jest.mock("@/app/actions/getCurrentUser", () => ({
  __esModule: true,
  default: () => mockGetCurrentUser(),
}))

jest.mock("@/app/lib/prismadb", () => ({
  __esModule: true,
  default: {
    conversation: {
      findFirst: (args: unknown) => mockConversationFindFirst(args),
      update: (args: unknown) => mockConversationUpdate(args),
    },
    message: { create: (args: unknown) => mockMessageCreate(args) },
    user: { findUnique: (args: unknown) => mockUserFindUnique(args) },
    contentReport: { create: (args: unknown) => mockContentReportCreate(args) },
  },
}))

jest.mock("@/app/lib/pusher", () => ({
  pusherServer: { trigger: (...args: unknown[]) => mockPusherTrigger(...args) },
}))

jest.mock("@/app/lib/pusher-channels", () => ({
  PUSHER_PRESENCE_CHANNEL: "presence-messenger",
  getPusherConversationChannel: (id: string) => "private-conversation-" + id,
  getPusherUserChannel: (id: string) => "private-user-" + id,
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

jest.mock("@/app/lib/moderation", () => ({
  moderateTextModelAssisted: (text: string) => mockModerateText(text),
  buildModerationDetails: () => "details",
  moderationReasonFromCategories: () => "SPAM",
}))

jest.mock("@/app/lib/nsfw", () => ({
  canAccessNsfw: () => true,
}))

jest.mock("@/app/lib/ai-message-content", () => ({
  buildAiMessageContent: (...args: unknown[]) => mockBuildAiMessageContent(...args),
  buildAiConversationHistory: (...args: unknown[]) => mockBuildAiConversationHistory(...args),
}))

jest.mock("@/app/lib/ai-model-routing", () => ({
  getModelForUser: () => "claude-sonnet-4-5-20250929",
}))

jest.mock("@/app/lib/web-push", () => ({
  sendWebPushToUser: (...args: unknown[]) => mockSendWebPush(...args),
  getVapidPublicKey: () => null,
}))

jest.mock("@/app/lib/ai-personalities", () => ({
  isValidPersonality: () => true,
  getDefaultPersonality: () => "assistant",
  getSystemPrompt: () => "You are a helpful assistant.",
}))

jest.mock("@/app/lib/ai-memory", () => ({
  getRelevantMemories: (...args: unknown[]) => mockGetRelevantMemories(...args),
  buildMemoryContext: (...args: unknown[]) => mockBuildMemoryContext(...args),
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
  return new NextRequest("http://localhost:3000/api/ai/chat-stream", {
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
      usage: { input_tokens: 15, output_tokens: 25 },
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
  character: null,
  mutedBy: [],
  messages: [],
}

const testUserMessage = {
  id: "msg-user-1",
  body: "Hello AI",
  conversationId: "conv-1",
  senderId: "user-1",
  isAI: false,
  seen: [testUser],
  sender: testUser,
}

const testAiMessage = {
  id: "msg-ai-1",
  body: "Hello there!",
  conversationId: "conv-1",
  senderId: "user-1",
  isAI: true,
  inputTokens: 15,
  outputTokens: 25,
  seen: [testUser],
  sender: testUser,
}

beforeEach(() => {
  jest.clearAllMocks()
  mockVerifyCsrfToken.mockReturnValue(true)
  mockAiChatLimiterCheck.mockReturnValue(true)
  mockGetCurrentUser.mockResolvedValue(testUser)
  mockConversationFindFirst.mockResolvedValue(testConversation)
  mockMessageCreate.mockResolvedValueOnce(testUserMessage).mockResolvedValueOnce(testAiMessage)
  mockConversationUpdate.mockResolvedValue({ id: "conv-1" })
  mockUserFindUnique.mockResolvedValue({ browserNotifications: false, notifyOnAIComplete: false })
  mockPusherTrigger.mockResolvedValue(undefined)
  mockGetAiAccessDecision.mockResolvedValue({
    allowed: true,
    limits: { isPro: false, monthlyMessageCount: 1, monthlyMessageLimit: 10 },
  })
  mockTrackAiUsage.mockResolvedValue(undefined)
  mockModerateText.mockResolvedValue({ shouldBlock: false, shouldReview: false, categories: [] })
  mockAnthropicStream.mockReturnValue(
    buildFakeStream([
      { type: "content_block_delta", delta: { type: "text_delta", text: "Hello " } },
      { type: "content_block_delta", delta: { type: "text_delta", text: "there!" } },
    ])
  )
  mockBuildAiMessageContent.mockReturnValue({
    content: "Hello AI",
    sanitizedText: "Hello AI",
    sanitizedImage: null,
  })
  mockBuildAiConversationHistory.mockReturnValue([])
  mockSendWebPush.mockResolvedValue(undefined)
  mockContentReportCreate.mockResolvedValue({})
  mockGetRelevantMemories.mockResolvedValue([])
  mockBuildMemoryContext.mockReturnValue("")
})

describe("POST /api/ai/chat-stream", () => {
  it("returns 403 when CSRF token is invalid", async () => {
    mockVerifyCsrfToken.mockReturnValue(false)
    const response = await POST(createRequest({ message: "Hello", conversationId: "conv-1" }))
    expect(response.status).toBe(403)
    const data = await response.json()
    expect(data.code).toBe("CSRF_TOKEN_INVALID")
  })

  it("returns 429 when rate limit is exceeded", async () => {
    mockAiChatLimiterCheck.mockReturnValue(false)
    const response = await POST(createRequest({ message: "Hello", conversationId: "conv-1" }))
    expect(response.status).toBe(429)
    expect(response.headers.get("Retry-After")).toBe("60")
  })

  it("returns 401 when user is not authenticated", async () => {
    mockGetCurrentUser.mockResolvedValue(null)
    const response = await POST(createRequest({ message: "Hello", conversationId: "conv-1" }))
    expect(response.status).toBe(401)
  })

  it("returns 401 when authenticated user has no email", async () => {
    mockGetCurrentUser.mockResolvedValue({ id: "user-1" })
    const response = await POST(createRequest({ message: "Hello", conversationId: "conv-1" }))
    expect(response.status).toBe(401)
  })

  it("returns 400 when conversationId is missing", async () => {
    const response = await POST(createRequest({ message: "Hello" }))
    expect(response.status).toBe(400)
  })

  it("returns 400 when message exceeds 10000 characters", async () => {
    const response = await POST(
      createRequest({ message: "x".repeat(10001), conversationId: "conv-1" })
    )
    expect(response.status).toBe(400)
  })

  it("returns 400 when no message or image is provided", async () => {
    mockBuildAiMessageContent.mockReturnValue({
      content: null,
      sanitizedText: "",
      sanitizedImage: null,
    })
    const response = await POST(createRequest({ message: null, conversationId: "conv-1" }))
    expect(response.status).toBe(400)
    const data = await response.json()
    expect(data.error).toContain("required")
  })

  it("returns 400 when content is blocked by moderation", async () => {
    mockModerateText.mockResolvedValue({
      shouldBlock: true,
      shouldReview: false,
      categories: ["violence"],
    })
    const response = await POST(createRequest({ message: "bad content", conversationId: "conv-1" }))
    expect(response.status).toBe(400)
    const data = await response.json()
    expect(data.code).toBe("CONTENT_BLOCKED")
  })

  it("returns 403 when conversation not found or user not in conversation", async () => {
    mockConversationFindFirst.mockResolvedValue(null)
    const response = await POST(createRequest({ message: "Hello", conversationId: "other" }))
    expect(response.status).toBe(403)
  })

  it("returns 400 when conversation is not an AI conversation", async () => {
    mockConversationFindFirst.mockResolvedValue({ ...testConversation, isAI: false })
    const response = await POST(createRequest({ message: "Hello", conversationId: "conv-1" }))
    expect(response.status).toBe(400)
  })

  it("returns 402 when free tier message limit is exceeded", async () => {
    mockGetAiAccessDecision.mockResolvedValue({
      allowed: false,
      code: "FREE_TIER_MESSAGE_LIMIT_REACHED",
      message: "Limit reached",
      limits: { isPro: false, monthlyMessageCount: 10, monthlyMessageLimit: 10 },
    })
    const response = await POST(createRequest({ message: "Hello", conversationId: "conv-1" }))
    expect(response.status).toBe(402)
    const data = await response.json()
    expect(data.code).toBe("FREE_TIER_MESSAGE_LIMIT_REACHED")
  })

  it("returns 200 with text/event-stream content-type for valid request", async () => {
    const response = await POST(createRequest({ message: "Hello AI", conversationId: "conv-1" }))
    expect(response.status).toBe(200)
    expect(response.headers.get("Content-Type")).toBe("text/event-stream")
  })

  it("includes Cache-Control and Connection SSE headers", async () => {
    const response = await POST(createRequest({ message: "Hello AI", conversationId: "conv-1" }))
    expect(response.headers.get("Cache-Control")).toBe("no-cache, no-transform")
    expect(response.headers.get("Connection")).toBe("keep-alive")
  })

  it("streams SSE data chunks with type chunk", async () => {
    const response = await POST(createRequest({ message: "Hello AI", conversationId: "conv-1" }))
    const body = await readStreamToString(response)
    expect(body).toContain("data:")
    expect(body).toContain('"type":"chunk"')
  })

  it("streams the correct text content from Anthropic", async () => {
    const response = await POST(createRequest({ message: "Hello AI", conversationId: "conv-1" }))
    const body = await readStreamToString(response)
    expect(body).toContain("Hello ")
    expect(body).toContain("there!")
  })

  it("sends a done event at stream end with messageId and usage stats", async () => {
    const response = await POST(createRequest({ message: "Hello AI", conversationId: "conv-1" }))
    const body = await readStreamToString(response)
    expect(body).toContain('"type":"done"')
    expect(body).toContain('"messageId"')
    expect(body).toContain('"usage"')
  })

  it("creates the user message with isAI false before streaming", async () => {
    const response = await POST(createRequest({ message: "Hello AI", conversationId: "conv-1" }))
    await readStreamToString(response)
    expect(mockMessageCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ isAI: false }) })
    )
  })

  it("creates the AI message with token counts after streaming completes", async () => {
    const response = await POST(createRequest({ message: "Hello AI", conversationId: "conv-1" }))
    await readStreamToString(response)
    expect(mockMessageCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ isAI: true, inputTokens: 15, outputTokens: 25 }),
      })
    )
  })

  it("calls trackAiUsage with chat-stream request type and token counts", async () => {
    const response = await POST(createRequest({ message: "Hello AI", conversationId: "conv-1" }))
    await readStreamToString(response)
    expect(mockTrackAiUsage).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-1",
        conversationId: "conv-1",
        inputTokens: 15,
        outputTokens: 25,
        requestType: "chat-stream",
      })
    )
  })

  it("triggers Pusher events for user and AI messages after streaming", async () => {
    const response = await POST(createRequest({ message: "Hello AI", conversationId: "conv-1" }))
    await readStreamToString(response)
    expect(mockPusherTrigger).toHaveBeenCalledWith(
      "private-conversation-conv-1",
      "messages:new",
      expect.objectContaining({ isAI: false })
    )
    expect(mockPusherTrigger).toHaveBeenCalledWith(
      "private-conversation-conv-1",
      "messages:new",
      expect.objectContaining({ isAI: true })
    )
  })

  it("sends an SSE error event when Anthropic stream throws mid-stream", async () => {
    mockAnthropicStream.mockReturnValue({
      [Symbol.asyncIterator]: async function* () {
        yield { type: "content_block_delta", delta: { type: "text_delta", text: "partial" } }
        throw new Error("Anthropic stream failed")
      },
      finalMessage: jest.fn().mockResolvedValue({ usage: { input_tokens: 5, output_tokens: 3 } }),
    })
    const response = await POST(createRequest({ message: "Hello AI", conversationId: "conv-1" }))
    expect(response.status).toBe(200)
    const body = await readStreamToString(response)
    expect(body).toContain('"type":"error"')
  })

  it("creates a content report for messages flagged for review", async () => {
    mockModerateText.mockResolvedValue({
      shouldBlock: false,
      shouldReview: true,
      categories: ["spam"],
    })
    const response = await POST(createRequest({ message: "Buy crypto!", conversationId: "conv-1" }))
    await readStreamToString(response)
    expect(mockContentReportCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          targetType: "CONVERSATION",
          targetId: "conv-1",
          status: "OPEN",
        }),
      })
    )
  })

  it("returns 500 on unexpected outer error before streaming starts", async () => {
    mockConversationFindFirst.mockRejectedValue(new Error("DB exploded"))
    const response = await POST(createRequest({ message: "Hello AI", conversationId: "conv-1" }))
    expect(response.status).toBe(500)
  })
})

export {}
