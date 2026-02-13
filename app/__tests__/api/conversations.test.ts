/**
 * @jest-environment node
 */

/**
 * API Route Tests: Conversations
 *
 * Tests POST /api/conversations
 */

import { NextRequest } from "next/server"
import { auth } from "@clerk/nextjs/server"

import { verifyCsrfToken } from "@/app/lib/csrf"
import prisma from "@/app/lib/prismadb"
// ---- Imports ----

import { POST } from "@/app/api/conversations/route"

// ---- Mocks ----

jest.mock("@clerk/nextjs/server", () => ({
  auth: jest.fn(() => Promise.resolve({ userId: "clerk_123" })),
}))

jest.mock("@/app/lib/prismadb", () => ({
  __esModule: true,
  default: {
    user: { findUnique: jest.fn() },
    conversation: { create: jest.fn(), findMany: jest.fn(), update: jest.fn() },
    character: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    message: { create: jest.fn() },
  },
}))

jest.mock("@/app/lib/pusher", () => ({
  pusherServer: { trigger: jest.fn(() => Promise.resolve()) },
}))

jest.mock("@/app/lib/csrf", () => ({
  verifyCsrfToken: jest.fn(() => true),
}))

jest.mock("@/app/lib/sanitize", () => ({
  sanitizePlainText: jest.fn((text: string) => text),
}))

// ---- Helpers ----

function createRequest(body: object): NextRequest {
  return new NextRequest("http://localhost:3000/api/conversations", {
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
  name: null,
  isGroup: false,
  isAI: false,
  users: [testUser, { id: "user-2", email: "other@example.com" }],
  messages: [],
}

// ---- Tests ----

beforeEach(() => {
  jest.clearAllMocks()
  ;(prisma.user.findUnique as jest.Mock).mockResolvedValue(testUser)
  ;(auth as unknown as jest.Mock).mockResolvedValue({ userId: "clerk_123" })
  ;(verifyCsrfToken as jest.Mock).mockReturnValue(true)
  ;(prisma.character.findMany as jest.Mock).mockResolvedValue([])
})

describe("POST /api/conversations", () => {
  it("creates a direct conversation", async () => {
    ;(prisma.conversation.findMany as jest.Mock).mockResolvedValue([])
    ;(prisma.conversation.create as jest.Mock).mockResolvedValue(testConversation)

    const request = createRequest({ userId: "user-2" })
    const response = await POST(request)
    expect(response.status).toBe(200)

    const data = await response.json()
    expect(data.users).toHaveLength(2)
  })

  it("returns existing conversation for direct chat", async () => {
    ;(prisma.conversation.findMany as jest.Mock).mockResolvedValue([testConversation])

    const request = createRequest({ userId: "user-2" })
    const response = await POST(request)
    expect(response.status).toBe(200)

    const data = await response.json()
    expect(data.id).toBe("conv-1")
    expect(prisma.conversation.create).not.toHaveBeenCalled()
  })

  it("creates a group conversation", async () => {
    const groupConversation = {
      ...testConversation,
      isGroup: true,
      name: "Test Group",
      users: [
        testUser,
        { id: "user-2", email: "a@test.com" },
        { id: "user-3", email: "b@test.com" },
      ],
    }
    ;(prisma.conversation.create as jest.Mock).mockResolvedValue(groupConversation)

    const request = createRequest({
      isGroup: true,
      members: ["user-1", "user-2", "user-3"],
      name: "Test Group",
    })

    const response = await POST(request)
    expect(response.status).toBe(200)

    const data = await response.json()
    expect(data.isGroup).toBe(true)
    expect(data.name).toBe("Test Group")
  })

  it("creates an AI conversation", async () => {
    const aiConversation = {
      ...testConversation,
      isAI: true,
      name: "AI Assistant",
      users: [testUser],
      messages: [],
    }
    ;(prisma.conversation.create as jest.Mock).mockResolvedValue(aiConversation)

    const request = createRequest({ isAI: true })
    const response = await POST(request)
    expect(response.status).toBe(200)

    const data = await response.json()
    expect(data.isAI).toBe(true)
  })

  it("creates AI conversation with character", async () => {
    const characterId = "550e8400-e29b-41d4-a716-446655440000"
    const character = {
      id: characterId,
      name: "Test Bot",
      systemPrompt: "You are a test bot",
      isPublic: true,
      greeting: "Hello!",
      createdById: "user-other",
    }
    ;(prisma.character.findUnique as jest.Mock).mockResolvedValue(character)
    ;(prisma.conversation.create as jest.Mock).mockResolvedValue({
      ...testConversation,
      isAI: true,
      name: "Test Bot",
      characterId,
    })
    ;(prisma.character.update as jest.Mock).mockResolvedValue(character)
    ;(prisma.message.create as jest.Mock).mockResolvedValue({
      id: "msg-greeting",
      body: "Hello!",
      isAI: true,
      sender: testUser,
      seen: [testUser],
    })
    ;(prisma.conversation.update as jest.Mock).mockResolvedValue({})

    const request = createRequest({
      isAI: true,
      characterId: characterId,
    })

    const response = await POST(request)
    expect(response.status).toBe(200)
    expect(prisma.character.update).toHaveBeenCalled()
  })

  it("creates AI scene conversation with multiple characters", async () => {
    const characterOneId = "550e8400-e29b-41d4-a716-446655440000"
    const characterTwoId = "550e8400-e29b-41d4-a716-446655440001"

    ;(prisma.character.findMany as jest.Mock).mockResolvedValue([
      {
        id: characterOneId,
        name: "Guide",
        tagline: "Calm strategist",
        description: "Thinks three steps ahead.",
        greeting: "Welcome to the mission.",
        systemPrompt: "You are a calm strategist.",
      },
      {
        id: characterTwoId,
        name: "Scout",
        tagline: "Fast and curious",
        description: "Finds shortcuts and opportunities.",
        greeting: "I'm already surveying the route.",
        systemPrompt: "You are energetic and observant.",
      },
    ])
    ;(prisma.conversation.create as jest.Mock).mockResolvedValue({
      ...testConversation,
      id: "scene-conv-1",
      isAI: true,
      name: "Scene: Guide + Scout",
      users: [testUser],
    })
    ;(prisma.character.updateMany as jest.Mock).mockResolvedValue({ count: 2 })
    ;(prisma.message.create as jest.Mock).mockResolvedValue({
      id: "scene-greeting",
      body: "Guide: Welcome to the mission.\n\nScout: I'm already surveying the route.",
      isAI: true,
      sender: testUser,
      seen: [testUser],
    })
    ;(prisma.conversation.update as jest.Mock).mockResolvedValue({})

    const request = createRequest({
      isAI: true,
      sceneCharacterIds: [characterOneId, characterTwoId],
      sceneScenario: "Two specialists preparing for a rescue mission.",
    })

    const response = await POST(request)
    expect(response.status).toBe(200)
    expect(prisma.character.updateMany).toHaveBeenCalled()
    expect(prisma.conversation.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          isAI: true,
          aiPersonality: "custom",
          aiSystemPrompt: expect.stringContaining("Scene setup provided by the user"),
        }),
      })
    )
  })

  it("returns 404 for non-existent character", async () => {
    ;(prisma.character.findUnique as jest.Mock).mockResolvedValue(null)

    const request = createRequest({
      isAI: true,
      characterId: "550e8400-e29b-41d4-a716-446655440000",
    })

    const response = await POST(request)
    expect(response.status).toBe(404)
  })

  it("returns 404 when a scene character is missing", async () => {
    const characterOneId = "550e8400-e29b-41d4-a716-446655440000"
    const characterTwoId = "550e8400-e29b-41d4-a716-446655440001"

    ;(prisma.character.findMany as jest.Mock).mockResolvedValue([
      {
        id: characterOneId,
        name: "Guide",
        tagline: null,
        description: null,
        greeting: null,
        systemPrompt: "You are a calm strategist.",
      },
    ])

    const request = createRequest({
      isAI: true,
      sceneCharacterIds: [characterOneId, characterTwoId],
    })

    const response = await POST(request)
    expect(response.status).toBe(404)
  })

  it("returns 401 when not authenticated", async () => {
    ;(auth as unknown as jest.Mock).mockResolvedValue({ userId: null })

    const request = createRequest({ userId: "user-2" })
    const response = await POST(request)
    expect(response.status).toBe(401)
  })

  it("returns 403 for invalid CSRF token", async () => {
    ;(verifyCsrfToken as jest.Mock).mockReturnValue(false)

    const request = createRequest({ userId: "user-2" })
    const response = await POST(request)
    expect(response.status).toBe(403)
  })

  it("returns 400 for invalid request body", async () => {
    const request = createRequest({})
    const response = await POST(request)
    expect(response.status).toBe(400)
  })

  it("returns 400 for group without enough members", async () => {
    const request = createRequest({
      isGroup: true,
      members: ["user-1"],
      name: "Test",
    })

    const response = await POST(request)
    expect(response.status).toBe(400)
  })
})

export {}
