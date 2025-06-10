/**
 * @jest-environment node
 */

/**
 * API Route Tests: AI Suggestions
 *
 * Tests POST /api/ai/suggestions
 */

import { NextRequest } from "next/server"

import { POST } from "@/app/api/ai/suggestions/route"

const mockGetCurrentUser = jest.fn()
const mockConversationFindFirst = jest.fn()
const mockVerifyCsrfToken = jest.fn()
const mockGetAiAccessDecision = jest.fn()
const mockGenerateSuggestions = jest.fn()
const mockGetCachedSuggestions = jest.fn()
const mockRateLimitCheckFn = jest.fn()

jest.mock("@/app/actions/getCurrentUser", () => ({
  __esModule: true,
  default: () => mockGetCurrentUser(),
}))

jest.mock("@/app/lib/prismadb", () => ({
  __esModule: true,
  default: {
    conversation: {
      findFirst: (args: unknown) => mockConversationFindFirst(args),
    },
  },
}))

jest.mock("@/app/lib/csrf", () => ({
  verifyCsrfToken: (...args: unknown[]) => mockVerifyCsrfToken(...args),
  getCsrfTokenFromRequest: () => "test-token",
}))

jest.mock("@/app/lib/rate-limit", () => ({
  suggestionsLimiter: { check: () => mockRateLimitCheckFn() },
  getClientIdentifier: () => "127.0.0.1",
}))

jest.mock("@/app/lib/ai-access", () => ({
  getAiAccessDecision: (userId: string) => mockGetAiAccessDecision(userId),
}))

jest.mock("@/app/lib/suggestions", () => ({
  generateSuggestions: (...args: unknown[]) => mockGenerateSuggestions(...args),
  getCachedSuggestions: (...args: unknown[]) => mockGetCachedSuggestions(...args),
}))

function createRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest("http://localhost:3000/api/ai/suggestions", {
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
  messages: [],
}

const testSuggestions = [
  { id: "s1", text: "Tell me more about that", type: "continue" },
  { id: "s2", text: "What are the alternatives?", type: "question" },
  { id: "s3", text: "Can you elaborate?", type: "reply" },
  { id: "s4", text: "Summarize this", type: "continue" },
]

beforeEach(() => {
  jest.clearAllMocks()
  mockVerifyCsrfToken.mockReturnValue(true)
  mockRateLimitCheckFn.mockReturnValue(true)
  mockGetCurrentUser.mockResolvedValue(testUser)
  mockConversationFindFirst.mockResolvedValue(testConversation)
  mockGetAiAccessDecision.mockResolvedValue({
    allowed: true,
    limits: { isPro: false, monthlyMessageCount: 1, monthlyMessageLimit: 10 },
  })
  mockGetCachedSuggestions.mockReturnValue(null)
  mockGenerateSuggestions.mockResolvedValue({
    suggestions: testSuggestions,
    type: "continue",
  })
})

describe("POST /api/ai/suggestions", () => {
  it("returns 403 when CSRF token is invalid", async () => {
    mockVerifyCsrfToken.mockReturnValue(false)
    const response = await POST(createRequest({ conversationId: "conv-1", type: "continue" }))
    expect(response.status).toBe(403)
    const data = await response.json()
    expect(data.code).toBe("CSRF_TOKEN_INVALID")
  })

  it("returns 429 when rate limit is exceeded", async () => {
    mockRateLimitCheckFn.mockReturnValue(false)
    const response = await POST(createRequest({ conversationId: "conv-1", type: "continue" }))
    expect(response.status).toBe(429)
    const data = await response.json()
    expect(data.code).toBe("RATE_LIMIT_EXCEEDED")
    expect(response.headers.get("Retry-After")).toBe("60")
  })

  it("returns 401 when user is not authenticated", async () => {
    mockGetCurrentUser.mockResolvedValue(null)
    const response = await POST(createRequest({ conversationId: "conv-1", type: "continue" }))
    expect(response.status).toBe(401)
    const data = await response.json()
    expect(data.code).toBe("UNAUTHORIZED")
  })

  it("returns 401 when authenticated user has no email", async () => {
    mockGetCurrentUser.mockResolvedValue({ id: "user-1" })
    const response = await POST(createRequest({ conversationId: "conv-1", type: "continue" }))
    expect(response.status).toBe(401)
  })

  it("returns 400 when conversationId is missing", async () => {
    const response = await POST(createRequest({ type: "continue" }))
    expect(response.status).toBe(400)
    const data = await response.json()
    expect(data.code).toBe("VALIDATION_ERROR")
  })

  it("returns 400 when type is missing", async () => {
    const response = await POST(createRequest({ conversationId: "conv-1" }))
    expect(response.status).toBe(400)
  })

  it("returns 400 when type is not a valid suggestion type", async () => {
    const response = await POST(createRequest({ conversationId: "conv-1", type: "invalid_type" }))
    expect(response.status).toBe(400)
    const data = await response.json()
    expect(data.code).toBe("VALIDATION_ERROR")
  })

  it("returns 404 when conversation not found or user not in conversation", async () => {
    mockConversationFindFirst.mockResolvedValue(null)
    const response = await POST(createRequest({ conversationId: "other", type: "continue" }))
    expect(response.status).toBe(404)
    const data = await response.json()
    expect(data.code).toBe("NOT_FOUND")
  })

  it("returns 400 when conversation is not an AI conversation", async () => {
    mockConversationFindFirst.mockResolvedValue({ ...testConversation, isAI: false })
    const response = await POST(createRequest({ conversationId: "conv-1", type: "continue" }))
    expect(response.status).toBe(400)
    const data = await response.json()
    expect(data.code).toBe("INVALID_CONVERSATION_TYPE")
  })

  it("returns 402 when AI access is denied (free tier limit)", async () => {
    mockGetAiAccessDecision.mockResolvedValue({
      allowed: false,
      code: "FREE_TIER_MESSAGE_LIMIT_REACHED",
      message: "Limit reached",
      limits: { isPro: false, monthlyMessageCount: 10, monthlyMessageLimit: 10 },
    })
    const response = await POST(createRequest({ conversationId: "conv-1", type: "continue" }))
    expect(response.status).toBe(402)
    const data = await response.json()
    expect(data.code).toBe("FREE_TIER_MESSAGE_LIMIT_REACHED")
  })

  it("returns 200 with suggestions array for a valid request", async () => {
    const response = await POST(createRequest({ conversationId: "conv-1", type: "continue" }))
    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data.suggestions).toHaveLength(4)
    expect(data.type).toBe("continue")
    expect(data.cached).toBe(false)
  })

  it("returns cached suggestions when available and skipCache is not set", async () => {
    mockGetCachedSuggestions.mockReturnValue({
      suggestions: [{ id: "c1", text: "cached suggestion", type: "continue" }],
      type: "continue",
    })
    const response = await POST(createRequest({ conversationId: "conv-1", type: "continue" }))
    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data.cached).toBe(true)
    expect(data.suggestions[0].text).toBe("cached suggestion")
    expect(mockGenerateSuggestions).not.toHaveBeenCalled()
  })

  it("bypasses cache when skipCache is true", async () => {
    mockGetCachedSuggestions.mockReturnValue({
      suggestions: [{ id: "c1", text: "cached", type: "continue" }],
      type: "continue",
    })
    const response = await POST(
      createRequest({ conversationId: "conv-1", type: "continue", skipCache: true })
    )
    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data.cached).toBe(false)
    expect(mockGenerateSuggestions).toHaveBeenCalled()
  })

  it("calls generateSuggestions with correct parameters", async () => {
    const response = await POST(
      createRequest({
        conversationId: "conv-1",
        type: "reply",
        partialInput: "Hello",
      })
    )
    expect(response.status).toBe(200)
    expect(mockGenerateSuggestions).toHaveBeenCalledWith(
      expect.objectContaining({
        partialInput: "Hello",
      }),
      "reply",
      expect.objectContaining({
        maxSuggestions: 4,
        tracking: expect.objectContaining({ userId: "user-1", conversationId: "conv-1" }),
      })
    )
  })

  it("accepts all valid suggestion types", async () => {
    const types = ["continue", "reply", "question", "rephrase"]
    for (const type of types) {
      const response = await POST(createRequest({ conversationId: "conv-1", type }))
      expect(response.status).toBe(200)
    }
  })

  it("handles empty conversation gracefully by returning suggestions", async () => {
    mockConversationFindFirst.mockResolvedValue({ ...testConversation, messages: [] })
    const response = await POST(createRequest({ conversationId: "conv-1", type: "continue" }))
    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data.suggestions).toBeDefined()
    expect(Array.isArray(data.suggestions)).toBe(true)
  })

  it("returns 500 when generateSuggestions throws an unexpected error", async () => {
    mockGenerateSuggestions.mockRejectedValue(new Error("Unexpected error"))
    const response = await POST(createRequest({ conversationId: "conv-1", type: "continue" }))
    expect(response.status).toBe(500)
    const data = await response.json()
    expect(data.code).toBe("INTERNAL_ERROR")
  })
})

export {}
