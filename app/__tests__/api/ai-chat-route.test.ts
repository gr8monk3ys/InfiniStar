/**
 * @jest-environment node
 */

/**
 * API Route Tests: AI Chat (non-streaming)
 *
 * Tests POST /api/ai/chat
 */

import { NextRequest, NextResponse } from "next/server"

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
const mockClaimAllowanceSlot = jest.fn()
const mockReleaseAllowanceClaim = jest.fn()
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

const mockAssembleTurn = jest.fn()

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

/**
 * The Turn's assembly is this route's dependency, not its responsibility — it is
 * covered end to end in `app/__tests__/lib/turn.test.ts`. What this route owns is
 * *what it asks for*: the conversation it authorised, the chatter whose memories
 * the Turn recalls, the Tier that decides model reachability, and the new input.
 * Those arguments are asserted below.
 */
jest.mock("@/app/lib/turn", () => ({
  ...jest.requireActual("@/app/lib/turn"),
  assembleTurn: (...args: unknown[]) => mockAssembleTurn(...args),
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
  claimAllowanceSlot: (...args: unknown[]) => mockClaimAllowanceSlot(...args),
  releaseAllowanceClaim: (...args: unknown[]) => mockReleaseAllowanceClaim(...args),
}))

jest.mock("@/app/lib/ai-usage", () => ({
  trackAiUsage: (...args: unknown[]) => mockTrackAiUsage(...args),
}))

jest.mock("@/app/lib/moderation", () => ({
  moderateTextModelAssisted: (...args: unknown[]) => mockModerateText(...args),
  buildModerationDetails: () => "details",
  moderationReasonFromCategories: () => "SPAM",
}))

// `matureAccess` is pure, so the real gate runs here rather than a constant
// stub. Stubbing it to `true` is why the mature-content gate was never exercised
// by a route test.

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

const testUser = {
  id: "user-1",
  email: "test@example.com",
  isAdult: true,
  nsfwEnabled: true,
  adultConfirmedAt: new Date("2026-01-01"),
}

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
  mockClaimAllowanceSlot.mockResolvedValue({
    ok: true,
    isPro: false,
    limits: {},
    claim: { id: "claim-1" },
  })
  mockReleaseAllowanceClaim.mockResolvedValue(undefined)
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
  mockAssembleTurn.mockResolvedValue({
    model: "claude-sonnet-4-5-20250929",
    system: [
      { type: "text", text: "You are a helpful assistant.", cache_control: { type: "ephemeral" } },
    ],
    messages: [{ role: "user", content: "Hello AI" }],
  })
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
    mockClaimAllowanceSlot.mockResolvedValue({
      ok: false,
      response: NextResponse.json(
        { error: "Limit reached", code: "FREE_TIER_MESSAGE_LIMIT_REACHED", limits: {} },
        { status: 402 }
      ),
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

  /**
   * Both messages go out through `publishNewMessage`, which emits the pairing:
   * the conversation channel so an open thread appends the message, and the
   * chatter's user channel so the sidebar re-sorts and shows the new preview.
   *
   * This asserted three triggers when only the AI message carried the sidebar
   * half; sending a message is as much a reason to re-sort the sidebar as
   * receiving a reply is, so both halves now fire for both messages.
   */
  it("publishes both halves of the pairing for the user message and the AI message", async () => {
    const request = createRequest({ message: "Hello AI", conversationId: "conv-1" })
    await POST(request)

    expect(mockPusherTrigger).toHaveBeenCalledTimes(4)

    for (const message of [testUserMessage, testAiMessage]) {
      expect(mockPusherTrigger).toHaveBeenCalledWith(
        "private-conversation-conv-1",
        "messages:new",
        message
      )
      expect(mockPusherTrigger).toHaveBeenCalledWith("private-user-user-1", "conversation:update", {
        id: "conv-1",
        messages: [message],
      })
    }
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
        max_tokens: 2048,
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

/**
 * The Turn is assembled identically however it was triggered. What differs
 * between the four trigger sites is only what they *ask* for, so that is what
 * each route's test asserts. The assembly itself is covered in
 * `app/__tests__/lib/turn.test.ts`.
 */
describe("what this route asks the Turn for", () => {
  it("passes the authorised conversation, the chatter, the tier and the new input", async () => {
    const request = createRequest({ message: "Hello AI", conversationId: "conv-1" })
    await POST(request)

    expect(mockAssembleTurn).toHaveBeenCalledTimes(1)
    expect(mockAssembleTurn).toHaveBeenCalledWith({
      conversation: testConversation,
      userId: "user-1",
      isPro: false,
      input: "Hello AI",
    })
  })

  /**
   * The Tier comes off the grant as a field. It used to be read back out of the
   * decision's optional `limits` bag as `limits?.isPro ?? false`, so a decision
   * that allowed without limits served a PRO chatter the free-tier model with
   * no error anywhere. There is no longer a shape that can express that.
   */
  it("routes a PRO chatter using the tier the grant carries", async () => {
    mockClaimAllowanceSlot.mockResolvedValue({ ok: true, isPro: true, limits: {} })

    const request = createRequest({ message: "Hello AI", conversationId: "conv-1" })
    await POST(request)

    expect(mockAssembleTurn).toHaveBeenCalledWith(expect.objectContaining({ isPro: true }))
  })

  it("returns the grant's own response when access is denied, and assembles nothing", async () => {
    mockClaimAllowanceSlot.mockResolvedValue({
      ok: false,
      response: NextResponse.json({ code: "FREE_TIER_MESSAGE_LIMIT_REACHED" }, { status: 402 }),
    })

    const request = createRequest({ message: "Hello AI", conversationId: "conv-1" })
    const response = await POST(request)

    expect(response.status).toBe(402)
    expect(mockAssembleTurn).not.toHaveBeenCalled()
  })
})

/**
 * The mature-content posture.
 *
 * `canAccessNsfw` was computed and then thrown away: moderation ran on the same
 * Turn with no knowledge of it, so a chatter who had confirmed adulthood and
 * opted in, talking to a mature Character, filed an OPEN ContentReport against
 * their own conversation every time a turn tripped a sexual review rule. The
 * queue filled in proportion to exactly the traffic the age gate exists to
 * permit.
 */
describe("moderation knows whether this is a mature conversation", () => {
  const MATURE_CONVERSATION = {
    ...testConversation,
    character: {
      name: "Elara",
      isNsfw: true,
      systemPrompt: "p",
      scenario: null,
      exampleDialogues: null,
    },
  }

  it("does not file a report on a consenting adult in a mature conversation", async () => {
    mockConversationFindFirst.mockResolvedValue(MATURE_CONVERSATION)
    mockModerateText.mockResolvedValue({ shouldBlock: false, shouldReview: false, categories: [] })

    await POST(createRequest({ message: "nsfw please", conversationId: "conv-1" }))

    expect(mockModerateText).toHaveBeenCalledWith(expect.any(String), "mature")
    expect(mockContentReportCreate).not.toHaveBeenCalled()
  })

  it("keeps the standard posture when the character is not mature", async () => {
    mockConversationFindFirst.mockResolvedValue(testConversation)

    await POST(createRequest({ message: "hello", conversationId: "conv-1" }))

    expect(mockModerateText).toHaveBeenCalledWith(expect.any(String), "standard")
  })

  /**
   * The gate, not the posture, is what keeps a non-consenting account out. An
   * account that has not opted in never reaches a mature conversation at all,
   * so it can never acquire the mature posture.
   */
  it("keeps the standard posture for an account that has not opted in", async () => {
    mockGetCurrentUser.mockResolvedValue({ ...testUser, nsfwEnabled: false })
    mockConversationFindFirst.mockResolvedValue(MATURE_CONVERSATION)

    const response = await POST(createRequest({ message: "hello", conversationId: "conv-1" }))

    expect(response.status).toBe(403)
    expect(mockModerateText).not.toHaveBeenCalledWith(expect.any(String), "mature")
  })

  it("still files a report for a non-sexual review signal in a mature conversation", async () => {
    mockConversationFindFirst.mockResolvedValue(MATURE_CONVERSATION)
    mockModerateText.mockResolvedValue({
      shouldBlock: false,
      shouldReview: true,
      categories: ["harassment"],
    })

    await POST(createRequest({ message: "you are worthless", conversationId: "conv-1" }))

    expect(mockContentReportCreate).toHaveBeenCalled()
  })

  it("still blocks in a mature conversation", async () => {
    mockConversationFindFirst.mockResolvedValue(MATURE_CONVERSATION)
    mockModerateText.mockResolvedValue({
      shouldBlock: true,
      shouldReview: false,
      categories: ["sexual"],
    })

    const response = await POST(createRequest({ message: "blocked", conversationId: "conv-1" }))

    expect(response.status).toBe(400)
    expect(mockMessageCreate).not.toHaveBeenCalled()
  })
})

/**
 * The Claim's release rule.
 *
 * Releasing too eagerly is worse than not releasing: it hands back an Allowance
 * slot that was genuinely spent, which is a free message. Releasing too little
 * costs the chatter one message, which is the safe direction.
 */
describe("the allowance claim", () => {
  it("passes the claim to trackAiUsage so the reserved row is filled in, not duplicated", async () => {
    await POST(createRequest({ message: "Hello AI", conversationId: "conv-1" }))

    expect(mockTrackAiUsage).toHaveBeenCalledWith(expect.objectContaining({ claimId: "claim-1" }))
  })

  it("does not release a claim for a turn that produced a reply", async () => {
    await POST(createRequest({ message: "Hello AI", conversationId: "conv-1" }))

    expect(mockReleaseAllowanceClaim).not.toHaveBeenCalled()
  })

  it("releases the claim when the provider call fails", async () => {
    mockAnthropicCreate.mockRejectedValue(new Error("anthropic is down"))

    const response = await POST(createRequest({ message: "Hello AI", conversationId: "conv-1" }))

    expect(response.status).toBe(500)
    expect(mockReleaseAllowanceClaim).toHaveBeenCalledWith({ id: "claim-1" })
  })

  it("does not release when the turn was denied and never claimed", async () => {
    mockClaimAllowanceSlot.mockResolvedValue({
      ok: false,
      response: NextResponse.json({ code: "FREE_TIER_MESSAGE_LIMIT_REACHED" }, { status: 402 }),
    })

    await POST(createRequest({ message: "Hello AI", conversationId: "conv-1" }))

    expect(mockReleaseAllowanceClaim).not.toHaveBeenCalled()
  })

  /**
   * The failure that would give away a free message: the reply landed and was
   * recorded, then something later in the request threw. The slot was spent.
   */
  it("keeps the claim when usage was already recorded and a later step throws", async () => {
    mockMessageCreate.mockResolvedValueOnce(testUserMessage).mockResolvedValueOnce(testAiMessage)
    mockConversationUpdate.mockRejectedValue(new Error("write failed after the reply"))

    const response = await POST(createRequest({ message: "Hello AI", conversationId: "conv-1" }))

    expect(response.status).toBe(500)
    expect(mockTrackAiUsage).toHaveBeenCalled()
    expect(mockReleaseAllowanceClaim).not.toHaveBeenCalled()
  })
})

export {}
