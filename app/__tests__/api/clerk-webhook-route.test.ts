/**
 * @jest-environment node
 */

/**
 * API Route Tests: Clerk Webhook
 *
 * Tests POST /api/webhooks/clerk
 */

import { headers } from "next/headers"

import prisma from "@/app/lib/prismadb"
import { POST } from "@/app/api/webhooks/clerk/route"

// ---- Mocks ----

jest.mock("@/app/lib/prismadb", () => ({
  __esModule: true,
  default: {
    user: {
      upsert: jest.fn(),
      delete: jest.fn(),
    },
  },
}))

// Mock the svix Webhook class so we control verification behaviour.
jest.mock("svix", () => ({
  Webhook: jest.fn().mockImplementation(() => ({
    verify: jest.fn(),
  })),
}))

jest.mock("next/headers", () => ({
  headers: jest.fn(),
}))

// ---- Helpers ----

const originalEnv = process.env

/** Build a minimal Clerk webhook request with svix headers */
function makeWebhookRequest(body = "{}"): Request {
  return new Request("http://localhost:3000/api/webhooks/clerk", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "svix-id": "msg_test_123",
      "svix-timestamp": "1700000000",
      "svix-signature": "v1,test_signature",
    },
    body,
  })
}

/** Helper to create a valid Clerk user event payload */
function makeUserPayload(overrides?: object) {
  return {
    id: "clerk_user_abc",
    email_addresses: [{ email_address: "alice@example.com" }],
    first_name: "Alice",
    last_name: "Smith",
    image_url: "https://example.com/avatar.jpg",
    ...overrides,
  }
}

// ---- Setup ----

beforeEach(() => {
  jest.clearAllMocks()

  process.env = {
    ...originalEnv,
    CLERK_WEBHOOK_SECRET: "whsec_test_secret",
  }

  // Set up the headers mock to return valid svix headers
  ;(headers as jest.Mock).mockResolvedValue({
    get: (name: string) => {
      const map: Record<string, string> = {
        "svix-id": "msg_test_123",
        "svix-timestamp": "1700000000",
        "svix-signature": "v1,test_signature",
      }
      return map[name] ?? null
    },
  })

  // Default: verification succeeds and returns a user.created event
  const { Webhook } = require("svix")
  Webhook.mockImplementation(() => ({
    verify: jest.fn().mockReturnValue({
      type: "user.created",
      data: makeUserPayload(),
    }),
  }))
})

afterAll(() => {
  process.env = originalEnv
})

// ---- Tests ----

describe("POST /api/webhooks/clerk", () => {
  it("returns 500 when CLERK_WEBHOOK_SECRET is not configured", async () => {
    delete process.env.CLERK_WEBHOOK_SECRET

    const response = await POST(makeWebhookRequest())
    expect(response.status).toBe(500)
    const text = await response.text()
    expect(text).toMatch(/secret not configured/i)
  })

  it("returns 400 when svix headers are missing", async () => {
    ;(headers as jest.Mock).mockResolvedValue({
      get: () => null,
    })

    const response = await POST(makeWebhookRequest())
    expect(response.status).toBe(400)
    const text = await response.text()
    expect(text).toMatch(/missing svix headers/i)
  })

  it("returns 400 when svix signature is invalid", async () => {
    const { Webhook } = require("svix")
    Webhook.mockImplementation(() => ({
      verify: jest.fn().mockImplementation(() => {
        throw new Error("Invalid signature")
      }),
    }))

    const response = await POST(makeWebhookRequest())
    expect(response.status).toBe(400)
    const text = await response.text()
    expect(text).toMatch(/invalid webhook signature/i)
  })

  it("handles user.created: creates User record with clerkId, email, name, image", async () => {
    const { Webhook } = require("svix")
    Webhook.mockImplementation(() => ({
      verify: jest.fn().mockReturnValue({
        type: "user.created",
        data: makeUserPayload(),
      }),
    }))
    ;(prisma.user.upsert as jest.Mock).mockResolvedValue({ id: "db-user-1" })

    const response = await POST(makeWebhookRequest())
    expect(response.status).toBe(200)

    expect(prisma.user.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { clerkId: "clerk_user_abc" },
        create: expect.objectContaining({
          clerkId: "clerk_user_abc",
          email: "alice@example.com",
          name: "Alice Smith",
          image: "https://example.com/avatar.jpg",
          emailVerified: expect.any(Date),
        }),
        update: expect.objectContaining({
          email: "alice@example.com",
          name: "Alice Smith",
          image: "https://example.com/avatar.jpg",
        }),
      })
    )
  })

  it("handles user.created with null first/last name", async () => {
    const { Webhook } = require("svix")
    Webhook.mockImplementation(() => ({
      verify: jest.fn().mockReturnValue({
        type: "user.created",
        data: makeUserPayload({ first_name: null, last_name: null }),
      }),
    }))
    ;(prisma.user.upsert as jest.Mock).mockResolvedValue({ id: "db-user-2" })

    const response = await POST(makeWebhookRequest())
    expect(response.status).toBe(200)

    expect(prisma.user.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          name: null, // empty trim becomes null
        }),
      })
    )
  })

  it("handles user.updated: updates email, name, and image for existing user", async () => {
    const { Webhook } = require("svix")
    Webhook.mockImplementation(() => ({
      verify: jest.fn().mockReturnValue({
        type: "user.updated",
        data: makeUserPayload({
          email_addresses: [{ email_address: "updated@example.com" }],
          first_name: "Updated",
          last_name: "Name",
          image_url: "https://example.com/new-avatar.jpg",
        }),
      }),
    }))
    ;(prisma.user.upsert as jest.Mock).mockResolvedValue({ id: "db-user-1" })

    const response = await POST(makeWebhookRequest())
    expect(response.status).toBe(200)

    expect(prisma.user.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { clerkId: "clerk_user_abc" },
        update: expect.objectContaining({
          email: "updated@example.com",
          name: "Updated Name",
          image: "https://example.com/new-avatar.jpg",
        }),
      })
    )
  })

  it("handles user.deleted: deletes User record by clerkId", async () => {
    const { Webhook } = require("svix")
    Webhook.mockImplementation(() => ({
      verify: jest.fn().mockReturnValue({
        type: "user.deleted",
        data: makeUserPayload(),
      }),
    }))
    ;(prisma.user.delete as jest.Mock).mockResolvedValue({ id: "db-user-1" })

    const response = await POST(makeWebhookRequest())
    expect(response.status).toBe(200)

    expect(prisma.user.delete).toHaveBeenCalledWith({
      where: { clerkId: "clerk_user_abc" },
    })
  })

  it("handles user.deleted gracefully when user does not exist in database", async () => {
    const { Webhook } = require("svix")
    Webhook.mockImplementation(() => ({
      verify: jest.fn().mockReturnValue({
        type: "user.deleted",
        data: makeUserPayload(),
      }),
    }))
    // Simulate P2025: record not found
    ;(prisma.user.delete as jest.Mock).mockRejectedValue(new Error("Record not found"))

    const response = await POST(makeWebhookRequest())
    // Route catches the delete error and swallows it — still 200
    expect(response.status).toBe(200)
  })

  it("handles unknown event type gracefully with 200 no-op", async () => {
    const { Webhook } = require("svix")
    Webhook.mockImplementation(() => ({
      verify: jest.fn().mockReturnValue({
        type: "session.created",
        data: {},
      }),
    }))

    const response = await POST(makeWebhookRequest())
    expect(response.status).toBe(200)
    const text = await response.text()
    expect(text).toBe("OK")

    // No database operations should have been called
    expect(prisma.user.upsert).not.toHaveBeenCalled()
    expect(prisma.user.delete).not.toHaveBeenCalled()
  })

  it("returns 200 OK text on successful processing", async () => {
    const { Webhook } = require("svix")
    Webhook.mockImplementation(() => ({
      verify: jest.fn().mockReturnValue({
        type: "user.created",
        data: makeUserPayload(),
      }),
    }))
    ;(prisma.user.upsert as jest.Mock).mockResolvedValue({ id: "db-user-1" })

    const response = await POST(makeWebhookRequest())
    expect(response.status).toBe(200)
    const text = await response.text()
    expect(text).toBe("OK")
  })
})

export {}
