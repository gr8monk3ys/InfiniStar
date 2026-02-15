/**
 * @jest-environment node
 */

import { NextRequest } from "next/server"

const mockGetCurrentUser = jest.fn()

jest.mock("@/app/actions/getCurrentUser", () => ({
  __esModule: true,
  default: () => mockGetCurrentUser(),
}))

jest.mock("@/app/lib/rate-limit", () => ({
  aiChatLimiter: { check: () => true },
  getClientIdentifier: () => "test-client",
}))

function createRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost:3000/api/ai/transcribe", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-CSRF-Token": "csrf-token",
      cookie: "csrf-token=csrf-token",
    },
    body: JSON.stringify(body),
  })
}

describe("/api/ai/transcribe", () => {
  const originalEnv = process.env

  beforeEach(() => {
    jest.resetModules()
    jest.clearAllMocks()
    process.env = {
      ...originalEnv,
      OPENAI_API_KEY: "",
    }

    mockGetCurrentUser.mockResolvedValue({ id: "user-1", email: "user@example.com" })
  })

  afterAll(() => {
    process.env = originalEnv
  })

  it("returns 501 when OpenAI is not configured", async () => {
    const { POST } = await import("@/app/api/ai/transcribe/route")
    const res = await POST(createRequest({ audioUrl: "https://example.com/audio.webm" }))

    expect(res.status).toBe(501)
    const json = (await res.json()) as { error?: string }
    expect(json.error).toMatch(/not configured/i)
  })
})
