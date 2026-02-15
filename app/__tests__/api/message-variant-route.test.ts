/**
 * @jest-environment node
 */

import { NextRequest } from "next/server"

import { verifyCsrfToken } from "@/app/lib/csrf"
import prisma from "@/app/lib/prismadb"
import { pusherServer } from "@/app/lib/pusher"
import { apiLimiter } from "@/app/lib/rate-limit"
import getCurrentUser from "@/app/actions/getCurrentUser"
import { PATCH } from "@/app/api/messages/[messageId]/variant/route"

jest.mock("@/app/lib/prismadb", () => ({
  __esModule: true,
  default: {
    message: { findUnique: jest.fn(), update: jest.fn() },
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

jest.mock("@/app/actions/getCurrentUser", () => ({
  __esModule: true,
  default: jest.fn(() => Promise.resolve({ id: "user-1" })),
}))

function createRequest(
  body: object,
  method = "PATCH",
  url = "http://localhost:3000/api/messages/msg-1/variant"
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

describe("PATCH /api/messages/[messageId]/variant", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(verifyCsrfToken as jest.Mock).mockReturnValue(true)
    ;(apiLimiter.check as jest.Mock).mockReturnValue(true)
    ;(getCurrentUser as jest.Mock).mockResolvedValue({ id: "user-1" })
  })

  it("returns 403 for invalid CSRF token", async () => {
    ;(verifyCsrfToken as jest.Mock).mockReturnValue(false)
    const request = createRequest({ index: 0 })

    const response = await PATCH(request, { params: Promise.resolve({ messageId: "msg-1" }) })
    expect(response.status).toBe(403)
  })

  it("returns 429 when rate limited", async () => {
    ;(apiLimiter.check as jest.Mock).mockReturnValue(false)
    const request = createRequest({ index: 0 })

    const response = await PATCH(request, { params: Promise.resolve({ messageId: "msg-1" }) })
    expect(response.status).toBe(429)
  })

  it("returns 401 when not authenticated", async () => {
    ;(getCurrentUser as jest.Mock).mockResolvedValue(null)
    const request = createRequest({ index: 0 })

    const response = await PATCH(request, { params: Promise.resolve({ messageId: "msg-1" }) })
    expect(response.status).toBe(401)
  })

  it("returns 404 when message does not exist", async () => {
    ;(prisma.message.findUnique as jest.Mock).mockResolvedValue(null)
    const request = createRequest({ index: 0 })

    const response = await PATCH(request, { params: Promise.resolve({ messageId: "msg-404" }) })
    expect(response.status).toBe(404)
  })

  it("returns 403 when user is not in conversation", async () => {
    ;(prisma.message.findUnique as jest.Mock).mockResolvedValue({
      id: "msg-1",
      isAI: true,
      variants: ["a", "b"],
      conversation: { id: "conv-1", users: [{ id: "other-user" }] },
      sender: { id: "user-1" },
      seen: [],
      replyTo: null,
    })

    const request = createRequest({ index: 0 })
    const response = await PATCH(request, { params: Promise.resolve({ messageId: "msg-1" }) })
    expect(response.status).toBe(403)
  })

  it("returns 400 when message is not AI", async () => {
    ;(prisma.message.findUnique as jest.Mock).mockResolvedValue({
      id: "msg-1",
      isAI: false,
      variants: ["a", "b"],
      conversation: { id: "conv-1", users: [{ id: "user-1" }] },
      sender: { id: "user-1" },
      seen: [],
      replyTo: null,
    })

    const request = createRequest({ index: 0 })
    const response = await PATCH(request, { params: Promise.resolve({ messageId: "msg-1" }) })
    expect(response.status).toBe(400)
  })

  it("returns 400 when no variants exist", async () => {
    ;(prisma.message.findUnique as jest.Mock).mockResolvedValue({
      id: "msg-1",
      isAI: true,
      variants: [],
      conversation: { id: "conv-1", users: [{ id: "user-1" }] },
      sender: { id: "user-1" },
      seen: [],
      replyTo: null,
    })

    const request = createRequest({ index: 0 })
    const response = await PATCH(request, { params: Promise.resolve({ messageId: "msg-1" }) })
    expect(response.status).toBe(400)
  })

  it("returns 400 when index is out of range", async () => {
    ;(prisma.message.findUnique as jest.Mock).mockResolvedValue({
      id: "msg-1",
      isAI: true,
      variants: ["a", "b"],
      conversation: { id: "conv-1", users: [{ id: "user-1" }] },
      sender: { id: "user-1" },
      seen: [],
      replyTo: null,
    })

    const request = createRequest({ index: 5 })
    const response = await PATCH(request, { params: Promise.resolve({ messageId: "msg-1" }) })
    expect(response.status).toBe(400)
  })

  it("switches the active variant and triggers pusher update", async () => {
    ;(prisma.message.findUnique as jest.Mock).mockResolvedValue({
      id: "msg-1",
      isAI: true,
      variants: ["first", "second"],
      conversation: { id: "conv-1", users: [{ id: "user-1" }] },
      sender: { id: "user-1" },
      seen: [],
      replyTo: null,
    })
    ;(prisma.message.update as jest.Mock).mockResolvedValue({
      id: "msg-1",
      isAI: true,
      body: "second",
      activeVariant: 1,
      variants: ["first", "second"],
      sender: { id: "user-1" },
      seen: [],
      replyTo: null,
    })

    const request = createRequest({ index: 1 })
    const response = await PATCH(request, { params: Promise.resolve({ messageId: "msg-1" }) })
    expect(response.status).toBe(200)

    expect(prisma.message.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          body: "second",
          activeVariant: 1,
        }),
      })
    )

    expect(pusherServer.trigger).toHaveBeenCalledWith(
      expect.any(String),
      "message:update",
      expect.objectContaining({ id: "msg-1" })
    )
  })
})

export {}
