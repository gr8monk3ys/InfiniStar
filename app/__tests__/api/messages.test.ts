/**
 * @jest-environment node
 */

/**
 * API Route Tests: Messages
 *
 * Tests POST /api/messages, PATCH /api/messages/[messageId], DELETE /api/messages/[messageId]
 */

import { NextRequest } from "next/server"
import { auth } from "@clerk/nextjs/server"

import { verifyCsrfToken } from "@/app/lib/csrf"
import prisma from "@/app/lib/prismadb"
import { apiLimiter } from "@/app/lib/rate-limit"
import getCurrentUser from "@/app/actions/getCurrentUser"
import { DELETE, PATCH } from "@/app/api/messages/[messageId]/route"
// ---- Imports (after mocks) ----

import { POST } from "@/app/api/messages/route"

// ---- Mocks (jest.mock is hoisted, so define inline) ----

jest.mock("@clerk/nextjs/server", () => ({
  auth: jest.fn(() => Promise.resolve({ userId: "clerk_123" })),
}))

jest.mock("@/app/lib/prismadb", () => ({
  __esModule: true,
  default: {
    user: { findUnique: jest.fn() },
    message: { create: jest.fn(), findUnique: jest.fn(), findFirst: jest.fn(), update: jest.fn() },
    conversation: { findFirst: jest.fn(), update: jest.fn() },
  },
}))

jest.mock("@/app/lib/pusher", () => ({
  pusherServer: { trigger: jest.fn(() => Promise.resolve()) },
}))

jest.mock("@/app/lib/csrf", () => ({
  verifyCsrfToken: jest.fn(() => true),
}))

jest.mock("@/app/lib/rate-limit", () => ({
  apiLimiter: { check: jest.fn(() => true) },
  getClientIdentifier: jest.fn(() => "127.0.0.1"),
}))

jest.mock("@/app/lib/sanitize", () => ({
  sanitizeMessage: jest.fn((msg: string) => msg),
  sanitizeUrl: jest.fn((url: string) => url),
}))

jest.mock("@/app/actions/getCurrentUser", () => ({
  __esModule: true,
  default: jest.fn(() => Promise.resolve({ id: "user-1", email: "test@example.com" })),
}))

// ---- Helpers ----

function createRequest(
  body: object,
  method = "POST",
  url = "http://localhost:3000/api/messages"
): NextRequest {
  return new NextRequest(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      "X-CSRF-Token": "test-token",
      cookie: "csrf-token=test-token",
    },
    body: JSON.stringify(body),
  })
}

const testUser = { id: "user-1", email: "test@example.com" }
const testMessage = {
  id: "msg-1",
  body: "Hello world",
  image: null,
  conversationId: "conv-1",
  senderId: "user-1",
  isAI: false,
  isDeleted: false,
  editedAt: null,
  deletedAt: null,
  sender: testUser,
  seen: [testUser],
}

// ---- Tests ----

beforeEach(() => {
  jest.clearAllMocks()
  ;(prisma.user.findUnique as jest.Mock).mockResolvedValue(testUser)
  ;(auth as unknown as jest.Mock).mockResolvedValue({ userId: "clerk_123" })
  ;(verifyCsrfToken as jest.Mock).mockReturnValue(true)
  ;(apiLimiter.check as jest.Mock).mockReturnValue(true)
  ;(getCurrentUser as jest.Mock).mockResolvedValue(testUser)
})

describe("POST /api/messages", () => {
  it("creates a message with valid body", async () => {
    ;(prisma.conversation.findFirst as jest.Mock).mockResolvedValue({ id: "conv-1" })
    ;(prisma.message.create as jest.Mock).mockResolvedValue(testMessage)
    ;(prisma.conversation.update as jest.Mock).mockResolvedValue({
      id: "conv-1",
      users: [testUser],
    })

    const request = createRequest({
      message: "Hello world",
      conversationId: "conv-1",
    })

    const response = await POST(request)
    expect(response.status).toBe(200)

    const data = await response.json()
    expect(data.body).toBe("Hello world")
  })

  it("returns 403 for invalid CSRF token", async () => {
    ;(verifyCsrfToken as jest.Mock).mockReturnValue(false)

    const request = createRequest({
      message: "Hello",
      conversationId: "conv-1",
    })

    const response = await POST(request)
    expect(response.status).toBe(403)
  })

  it("returns 429 when rate limited", async () => {
    ;(apiLimiter.check as jest.Mock).mockReturnValue(false)

    const request = createRequest({
      message: "Hello",
      conversationId: "conv-1",
    })

    const response = await POST(request)
    expect(response.status).toBe(429)
  })

  it("returns 401 when not authenticated", async () => {
    ;(auth as unknown as jest.Mock).mockResolvedValue({ userId: null })

    const request = createRequest({
      message: "Hello",
      conversationId: "conv-1",
    })

    const response = await POST(request)
    expect(response.status).toBe(401)
  })

  it("returns 400 for empty message without image", async () => {
    ;(prisma.conversation.findFirst as jest.Mock).mockResolvedValue({ id: "conv-1" })

    const request = createRequest({
      message: "",
      conversationId: "conv-1",
    })

    const response = await POST(request)
    expect(response.status).toBe(400)
  })

  it("returns 403 when user is not in conversation", async () => {
    ;(prisma.conversation.findFirst as jest.Mock).mockResolvedValue(null)

    const request = createRequest({
      message: "Hello",
      conversationId: "conv-not-mine",
    })

    const response = await POST(request)
    expect(response.status).toBe(403)
  })
})

describe("PATCH /api/messages/[messageId]", () => {
  const patchParams = Promise.resolve({ messageId: "msg-1" })

  it("edits own message successfully", async () => {
    ;(prisma.message.findUnique as jest.Mock).mockResolvedValue(testMessage)
    ;(prisma.message.update as jest.Mock).mockResolvedValue({
      ...testMessage,
      body: "Updated",
      editedAt: new Date(),
    })

    const request = createRequest(
      { body: "Updated" },
      "PATCH",
      "http://localhost:3000/api/messages/msg-1"
    )

    const response = await PATCH(request, { params: patchParams })
    expect(response.status).toBe(200)

    const data = await response.json()
    expect(data.body).toBe("Updated")
  })

  it("returns 404 for non-existent message", async () => {
    ;(prisma.message.findUnique as jest.Mock).mockResolvedValue(null)

    const request = createRequest(
      { body: "Updated" },
      "PATCH",
      "http://localhost:3000/api/messages/msg-999"
    )

    const response = await PATCH(request, {
      params: Promise.resolve({ messageId: "msg-999" }),
    })
    expect(response.status).toBe(404)
  })

  it("returns 403 when editing another users message", async () => {
    ;(prisma.message.findUnique as jest.Mock).mockResolvedValue({
      ...testMessage,
      senderId: "user-other",
    })

    const request = createRequest(
      { body: "Updated" },
      "PATCH",
      "http://localhost:3000/api/messages/msg-1"
    )

    const response = await PATCH(request, { params: patchParams })
    expect(response.status).toBe(403)
  })

  it("returns 400 when editing deleted message", async () => {
    ;(prisma.message.findUnique as jest.Mock).mockResolvedValue({
      ...testMessage,
      isDeleted: true,
    })

    const request = createRequest(
      { body: "Updated" },
      "PATCH",
      "http://localhost:3000/api/messages/msg-1"
    )

    const response = await PATCH(request, { params: patchParams })
    expect(response.status).toBe(400)
  })

  it("returns 400 when editing AI message", async () => {
    ;(prisma.message.findUnique as jest.Mock).mockResolvedValue({
      ...testMessage,
      isAI: true,
    })

    const request = createRequest(
      { body: "Updated" },
      "PATCH",
      "http://localhost:3000/api/messages/msg-1"
    )

    const response = await PATCH(request, { params: patchParams })
    expect(response.status).toBe(400)
  })
})

describe("DELETE /api/messages/[messageId]", () => {
  const deleteParams = Promise.resolve({ messageId: "msg-1" })

  it("soft deletes own message", async () => {
    ;(prisma.message.findUnique as jest.Mock).mockResolvedValue(testMessage)
    ;(prisma.message.update as jest.Mock).mockResolvedValue({
      ...testMessage,
      isDeleted: true,
      deletedAt: new Date(),
      body: null,
      image: null,
    })

    const request = createRequest({}, "DELETE", "http://localhost:3000/api/messages/msg-1")

    const response = await DELETE(request, { params: deleteParams })
    expect(response.status).toBe(200)

    const data = await response.json()
    expect(data.isDeleted).toBe(true)
    expect(data.body).toBeNull()
  })

  it("returns 403 when deleting another users message", async () => {
    ;(prisma.message.findUnique as jest.Mock).mockResolvedValue({
      ...testMessage,
      senderId: "user-other",
    })

    const request = createRequest({}, "DELETE", "http://localhost:3000/api/messages/msg-1")

    const response = await DELETE(request, { params: deleteParams })
    expect(response.status).toBe(403)
  })

  it("returns 400 when message already deleted", async () => {
    ;(prisma.message.findUnique as jest.Mock).mockResolvedValue({
      ...testMessage,
      isDeleted: true,
    })

    const request = createRequest({}, "DELETE", "http://localhost:3000/api/messages/msg-1")

    const response = await DELETE(request, { params: deleteParams })
    expect(response.status).toBe(400)
  })
})

export {}
