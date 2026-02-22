/**
 * @jest-environment node
 */

/**
 * API Route Tests: Conversation Export
 *
 * Tests GET /api/conversations/[conversationId]/export
 */

import { NextRequest } from "next/server"

import prisma from "@/app/lib/prismadb"
import { apiLimiter } from "@/app/lib/rate-limit"
import getCurrentUser from "@/app/actions/getCurrentUser"
import { GET } from "@/app/api/conversations/[conversationId]/export/route"

// ---- Mocks ----

jest.mock("@/app/lib/prismadb", () => ({
  __esModule: true,
  default: {
    conversation: { findUnique: jest.fn() },
  },
}))

jest.mock("@/app/lib/rate-limit", () => ({
  apiLimiter: { check: jest.fn(() => true) },
  getClientIdentifier: jest.fn(() => "127.0.0.1"),
}))

jest.mock("@/app/actions/getCurrentUser", () => ({
  __esModule: true,
  default: jest.fn(() =>
    Promise.resolve({ id: "11111111-1111-4111-8111-111111111111", email: "user@example.com" })
  ),
}))

// The export lib functions are real — no need to mock them.

// ---- Helpers ----

const USER_ID = "11111111-1111-4111-8111-111111111111"
const CONV_ID = "22222222-2222-4222-8222-222222222222"

function makeRequest(conversationId: string, format?: string): NextRequest {
  const url = format
    ? `http://localhost:3000/api/conversations/${conversationId}/export?format=${format}`
    : `http://localhost:3000/api/conversations/${conversationId}/export`
  return new NextRequest(url, { method: "GET" })
}

const baseUser = { id: USER_ID, name: "Alice", email: "user@example.com" }
const otherUser = {
  id: "33333333-3333-4333-8333-333333333333",
  name: "Bob",
  email: "bob@example.com",
}

const baseConversation = {
  id: CONV_ID,
  name: "Test Chat",
  isAI: false,
  aiModel: null,
  aiPersonality: null,
  users: [baseUser, otherUser],
  messages: [
    {
      id: "msg-1",
      body: "Hello there",
      createdAt: new Date("2024-01-01T10:00:00Z"),
      isAI: false,
      isDeleted: false,
      sender: baseUser,
    },
    {
      id: "msg-2",
      body: "How are you?",
      createdAt: new Date("2024-01-01T10:01:00Z"),
      isAI: false,
      isDeleted: false,
      sender: otherUser,
    },
  ],
}

// ---- Tests ----

beforeEach(() => {
  jest.clearAllMocks()
  ;(apiLimiter.check as jest.Mock).mockReturnValue(true)
  ;(getCurrentUser as jest.Mock).mockResolvedValue(baseUser)
  ;(prisma.conversation.findUnique as jest.Mock).mockResolvedValue(baseConversation)
})

describe("GET /api/conversations/[conversationId]/export", () => {
  it("returns 401 when not authenticated", async () => {
    ;(getCurrentUser as jest.Mock).mockResolvedValue(null)

    const response = await GET(makeRequest(CONV_ID), {
      params: Promise.resolve({ conversationId: CONV_ID }),
    })

    expect(response.status).toBe(401)
  })

  it("returns 429 when rate limited", async () => {
    ;(apiLimiter.check as jest.Mock).mockReturnValue(false)

    const response = await GET(makeRequest(CONV_ID), {
      params: Promise.resolve({ conversationId: CONV_ID }),
    })

    expect(response.status).toBe(429)
  })

  it("returns 404 when conversation not found", async () => {
    ;(prisma.conversation.findUnique as jest.Mock).mockResolvedValue(null)

    const response = await GET(makeRequest(CONV_ID), {
      params: Promise.resolve({ conversationId: CONV_ID }),
    })

    expect(response.status).toBe(404)
    const data = await response.json()
    expect(data.error).toMatch(/not found/i)
  })

  it("returns 403 when user is not a participant", async () => {
    // Conversation with only otherUser, not baseUser
    ;(prisma.conversation.findUnique as jest.Mock).mockResolvedValue({
      ...baseConversation,
      users: [otherUser],
    })

    const response = await GET(makeRequest(CONV_ID), {
      params: Promise.resolve({ conversationId: CONV_ID }),
    })

    expect(response.status).toBe(403)
  })

  it("returns 400 for an invalid format parameter", async () => {
    const response = await GET(makeRequest(CONV_ID, "pdf"), {
      params: Promise.resolve({ conversationId: CONV_ID }),
    })

    expect(response.status).toBe(400)
    const data = await response.json()
    expect(data.error).toMatch(/invalid format/i)
  })

  it("exports as JSON format with correct Content-Type", async () => {
    const response = await GET(makeRequest(CONV_ID, "json"), {
      params: Promise.resolve({ conversationId: CONV_ID }),
    })

    expect(response.status).toBe(200)
    expect(response.headers.get("Content-Type")).toContain("application/json")

    const text = await response.text()
    const parsed = JSON.parse(text)
    expect(parsed).toHaveProperty("conversationId", CONV_ID)
    expect(parsed).toHaveProperty("messages")
    expect(parsed.totalMessages).toBe(2)
  })

  it("exports as markdown with correct Content-Type and filename header", async () => {
    const response = await GET(makeRequest(CONV_ID, "markdown"), {
      params: Promise.resolve({ conversationId: CONV_ID }),
    })

    expect(response.status).toBe(200)
    expect(response.headers.get("Content-Type")).toContain("text/markdown")

    const disposition = response.headers.get("Content-Disposition") ?? ""
    expect(disposition).toContain("attachment")
    expect(disposition).toMatch(/\.md"?$/)

    const text = await response.text()
    expect(text).toContain("# Test Chat")
    expect(text).toContain("Hello there")
  })

  it("defaults to markdown when no format param is given", async () => {
    const response = await GET(makeRequest(CONV_ID), {
      params: Promise.resolve({ conversationId: CONV_ID }),
    })

    expect(response.status).toBe(200)
    expect(response.headers.get("Content-Type")).toContain("text/markdown")
  })

  it("exports as plain text with correct Content-Type", async () => {
    const response = await GET(makeRequest(CONV_ID, "txt"), {
      params: Promise.resolve({ conversationId: CONV_ID }),
    })

    expect(response.status).toBe(200)
    expect(response.headers.get("Content-Type")).toContain("text/plain")

    const text = await response.text()
    expect(text).toContain("CONVERSATION: Test Chat")
    expect(text).toContain("Hello there")
  })

  it("exports a conversation with zero messages cleanly", async () => {
    ;(prisma.conversation.findUnique as jest.Mock).mockResolvedValue({
      ...baseConversation,
      messages: [],
    })

    const response = await GET(makeRequest(CONV_ID, "json"), {
      params: Promise.resolve({ conversationId: CONV_ID }),
    })

    expect(response.status).toBe(200)
    const text = await response.text()
    const parsed = JSON.parse(text)
    expect(parsed.totalMessages).toBe(0)
    expect(parsed.messages).toEqual([])
  })

  it("includes cache-control no-store headers", async () => {
    const response = await GET(makeRequest(CONV_ID, "json"), {
      params: Promise.resolve({ conversationId: CONV_ID }),
    })

    expect(response.headers.get("Cache-Control")).toContain("no-store")
  })
})

export {}
