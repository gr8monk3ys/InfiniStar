/**
 * @jest-environment node
 */

/**
 * API Route Tests: AI Chat (non-streaming)
 *
 * Tests POST /api/ai/chat
 */

import { NextRequest } from "next/server"

// Import AFTER all mocks are set up
import { POST } from "@/app/api/ai/chat/route"

// ---- Top-level mock factories (must be before imports) ----

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
const mockAnthropicCreate = jest.fn()
const mockBuildAiConversationHistory = jest.fn()
const mockBuildAiMessageContent = jest.fn()
const mockSendWebPush = jest.fn()

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
    message: {
      create: (args: unknown) => mockMessageCreate(args),
    },
    user: {
      findUnique: (args: unknown) => mockUserFindUnique(args),
    },
    contentReport: {
      create: (args: unknown) => mockContentReportCreate(args),
    },
  },
}))

jest.mock("@/app/lib/pusher-server", () => ({
  pusherServer: { trigger: (...args: unknown[]) => mockPusherTrigger(...args) },
}))

jest.mock("@/app/lib/pusher-channels", () => ({
  PUSHER_PRESENCE_CHANNEL: "presence-messenger",
  getPusherConversationChannel: (id: string) => `private-conversation-${id}`,
  getPusherUserChannel: (id: string) => `private-user-${id}`,
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

jest.mock("@/app/lib/anthropic", () => ({
  __esModule: true,
  default: {
    messages: {
      create: (...args: unknown[]) => mockAnthropicCreate(...args),
    },
  },
}))

// ---- Helpers ----

function createRequest(body: object): NextRequest {
  return new NextRequest("http://localhost:3000/api/ai/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-CSRF-Token": "test-token",
      cookie: "csrf-token=test-token",
    },
    body: JSON.stringify(body),
  })
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
  body: "Hello, how can I help you?",
  conversationId: "conv-1",
  senderId: "user-1",
  isAI: true,
  seen: [testUser],
  sender: testUser,
}

const testAnthropicResponse = {
  content: [{ type: "text", text: "Hello, how can I help you?" }],
  usage: { input_tokens: 10, output_tokens: 20 },
}

// ---- Tests ----

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
  mockAnthropicCreate.mockResolvedValue(testAnthropicResponse)
  mockBuildAiMessageContent.mockReturnValue({
    content: "Hello AI",
    sanitizedText: "Hello AI",
    sanitizedImage: null,
  })
  mockBuildAiConversationHistory.mockReturnValue([])
  mockSendWebPush.mockResolvedValue(undefined)
  mockContentReportCreate.mockResolvedValue({})
})

describe("POST /api/ai/chat", () => {
  it("returns 403 when CSRF token is invalid", async () => {
    mockVerifyCsrfToken.mockReturnValue(false)

    const request = createRequest({ message: "Hello", conversationId: "conv-1" })
    const response = await POST(request)

    expect(response.status).toBe(403)
    const data = await response.json()
    expect(data.code).toBe("CSRF_TOKEN_INVALID")
  })

  it("returns 429 when rate limit is exceeded", async () => {
    mockAiChatLimiterCheck.mockReturnValue(false)

    const request = createRequest({ message: "Hello", conversationId: "conv-1" })
    const response = await POST(request)

    expect(response.status).toBe(429)
    expect(response.headers.get("Retry-After")).toBe("60")
  })

  it("returns 401 when user is not authenticated", async () => {
    mockGetCurrentUser.mockResolvedValue(null)

    const request = createRequest({ message: "Hello", conversationId: "conv-1" })
    const response = await POST(request)

    expect(response.status).toBe(401)
  })

  it("returns 401 when authenticated user has no email", async () => {
    mockGetCurrentUser.mockResolvedValue({ id: "user-1" })

    const request = createRequest({ message: "Hello", conversationId: "conv-1" })
    const response = await POST(request)

    expect(response.status).toBe(401)
  })

  it("returns 400 when conversationId is missing from request body", async () => {
    const request = createRequest({ message: "Hello" })
    const response = await POST(request)

    expect(response.status).toBe(400)
  })

  it("returns 400 when message exceeds max length of 10000 characters", async () => {
    const request = createRequest({
      message: "x".repeat(10001),
      conversationId: "conv-1",
    })
    const response = await POST(request)

    expect(response.status).toBe(400)
  })

  it("returns 400 when neither message nor image is provided", async () => {
    mockBuildAiMessageContent.mockReturnValue({
      content: null,
      sanitizedText: "",
      sanitizedImage: null,
    })

    const request = createRequest({ message: null, conversationId: "conv-1" })
    const response = await POST(request)

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

    const request = createRequest({
      message: "How do I make a bomb",
      conversationId: "conv-1",
    })
    const response = await POST(request)

    expect(response.status).toBe(400)
    const data = await response.json()
    expect(data.code).toBe("CONTENT_BLOCKED")
  })

  it("returns 403 when conversation is not found or user is not a member", async () => {
    mockConversationFindFirst.mockResolvedValue(null)

    const request = createRequest({ message: "Hello", conversationId: "conv-not-mine" })
    const response = await POST(request)

    expect(response.status).toBe(403)
  })

  it("returns 400 when conversation is not an AI conversation", async () => {
    mockConversationFindFirst.mockResolvedValue({ ...testConversation, isAI: false })

    const request = createRequest({ message: "Hello", conversationId: "conv-1" })
    const response = await POST(request)

    expect(response.status).toBe(400)
  })

  it("returns 402 when free tier message limit is exceeded", async () => {
    mockGetAiAccessDecision.mockResolvedValue({
      allowed: false,
      code: "FREE_TIER_MESSAGE_LIMIT_REACHED",
      message: "You have reached the free-tier monthly AI message limit.",
      limits: { isPro: false, monthlyMessageCount: 10, monthlyMessageLimit: 10 },
    })

    const request = createRequest({ message: "Hello", conversationId: "conv-1" })
    const response = await POST(request)

    expect(response.status).toBe(402)
    const data = await response.json()
    expect(data.code).toBe("FREE_TIER_MESSAGE_LIMIT_REACHED")
  })

  it("returns 200 with user and AI messages on a valid request", async () => {
    const request = createRequest({ message: "Hello AI", conversationId: "conv-1" })
    const response = await POST(request)

    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data.userMessage).toBeDefined()
    expect(data.aiMessage).toBeDefined()
    expect(data.aiMessage.isAI).toBe(true)
  })

  it("creates the user message in the database with isAI false", async () => {
    const request = createRequest({ message: "Hello AI", conversationId: "conv-1" })
    await POST(request)

    expect(mockMessageCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          isAI: false,
        }),
      })
    )
  })

  it("creates the AI message in the database with isAI true", async () => {
    const request = createRequest({ message: "Hello AI", conversationId: "conv-1" })
    await POST(request)

    expect(mockMessageCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          isAI: true,
        }),
      })
    )
  })

  it("calls trackAiUsage with correct parameters including token counts", async () => {
    const request = createRequest({ message: "Hello AI", conversationId: "conv-1" })
    await POST(request)

    expect(mockTrackAiUsage).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-1",
        conversationId: "conv-1",
        inputTokens: 10,
        outputTokens: 20,
        requestType: "chat",
      })
    )
  })

  it("triggers Pusher events for both user message and AI message", async () => {
    const request = createRequest({ message: "Hello AI", conversationId: "conv-1" })
    await POST(request)

    // user message event + AI message event + conversation:update event
    expect(mockPusherTrigger).toHaveBeenCalledTimes(3)
    expect(mockPusherTrigger).toHaveBeenCalledWith(
      "private-conversation-conv-1",
      "messages:new",
      testUserMessage
    )
    expect(mockPusherTrigger).toHaveBeenCalledWith(
      "private-conversation-conv-1",
      "messages:new",
      testAiMessage
    )
  })

  it("updates conversation lastMessageAt after AI response", async () => {
    const request = createRequest({ message: "Hello AI", conversationId: "conv-1" })
    await POST(request)

    expect(mockConversationUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "conv-1" },
        data: expect.objectContaining({ lastMessageAt: expect.any(Date) }),
      })
    )
  })

  it("creates a content report for messages flagged for review but not blocked", async () => {
    mockModerateText.mockResolvedValue({
      shouldBlock: false,
      shouldReview: true,
      categories: ["spam"],
    })

    const request = createRequest({ message: "Buy now!", conversationId: "conv-1" })
    await POST(request)

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

  it("calls the Anthropic API with a system prompt and conversation history", async () => {
    const request = createRequest({ message: "Hello AI", conversationId: "conv-1" })
    await POST(request)

    expect(mockAnthropicCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        system: expect.arrayContaining([
          expect.objectContaining({
            type: "text",
            cache_control: { type: "ephemeral" },
          }),
        ]),
        messages: expect.any(Array),
        max_tokens: 1024,
      })
    )
  })

  it("does not call Anthropic API when moderation blocks the message", async () => {
    mockModerateText.mockResolvedValue({
      shouldBlock: true,
      shouldReview: false,
      categories: ["violence"],
    })

    const request = createRequest({ message: "Blocked content", conversationId: "conv-1" })
    await POST(request)

    expect(mockAnthropicCreate).not.toHaveBeenCalled()
    expect(mockMessageCreate).not.toHaveBeenCalled()
  })

  it("returns 500 on unexpected internal error (DB failure)", async () => {
    mockConversationFindFirst.mockRejectedValue(new Error("DB crashed"))

    const request = createRequest({ message: "Hello AI", conversationId: "conv-1" })
    const response = await POST(request)

    expect(response.status).toBe(500)
  })
})

export {}
