/**
 * @jest-environment node
 */

import { NextRequest } from "next/server"

const mockGetCurrentUser = jest.fn()
const mockFindFirst = jest.fn()

jest.mock("@/app/actions/getCurrentUser", () => ({
  __esModule: true,
  default: () => mockGetCurrentUser(),
}))

jest.mock("@/app/lib/ai-access", () => ({
  getAiAccessDecision: async () => ({ allowed: true }),
}))

jest.mock("@/app/lib/prismadb", () => ({
  __esModule: true,
  default: {
    conversation: {
      findFirst: (args: unknown) => mockFindFirst(args),
    },
  },
}))

jest.mock("@/app/lib/pusher", () => ({
  pusherServer: { trigger: jest.fn() },
}))

jest.mock("@/app/lib/pusher-channels", () => ({
  getPusherConversationChannel: () => "conversation-channel",
  getPusherUserChannel: () => "user-channel",
}))

jest.mock("@/app/lib/rate-limit", () => ({
  aiChatLimiter: { check: () => true },
  getClientIdentifier: () => "test-client",
}))

function createRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost:3000/api/ai/image/generate", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-CSRF-Token": "csrf-token",
      cookie: "csrf-token=csrf-token",
    },
    body: JSON.stringify(body),
  })
}

describe("/api/ai/image/generate", () => {
  const originalEnv = process.env

  beforeEach(() => {
    jest.resetModules()
    jest.clearAllMocks()
    process.env = {
      ...originalEnv,
      OPENAI_API_KEY: "",
      NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME: "demo",
      NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET: "preset",
    }

    mockGetCurrentUser.mockResolvedValue({ id: "user-1", email: "user@example.com" })
    mockFindFirst.mockResolvedValue({ id: "conv-1", isAI: true })
  })

  afterAll(() => {
    process.env = originalEnv
  })

  it("returns 501 when OpenAI is not configured", async () => {
    const { POST } = await import("@/app/api/ai/image/generate/route")
    const res = await POST(
      createRequest({
        conversationId: "11111111-1111-1111-8111-111111111111",
        prompt: "A cozy cabin in the woods at sunrise",
        size: "1024x1024",
      })
    )

    expect(res.status).toBe(501)
    const json = (await res.json()) as { error?: string }
    expect(json.error).toMatch(/not configured/i)
  })
})
