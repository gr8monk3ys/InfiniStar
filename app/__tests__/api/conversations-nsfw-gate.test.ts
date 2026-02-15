/**
 * @jest-environment node
 */

import { NextRequest } from "next/server"

const mockAuth = jest.fn()
const mockUserFindUnique = jest.fn()
const mockCharacterFindUnique = jest.fn()
const mockConversationCreate = jest.fn()

jest.mock("@clerk/nextjs/server", () => ({
  auth: () => mockAuth(),
}))

jest.mock("@/app/lib/prismadb", () => ({
  __esModule: true,
  default: {
    user: {
      findUnique: (args: unknown) => mockUserFindUnique(args),
    },
    character: {
      findUnique: (args: unknown) => mockCharacterFindUnique(args),
    },
    conversation: {
      create: (args: unknown) => mockConversationCreate(args),
    },
  },
}))

function createRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost:3000/api/conversations", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-CSRF-Token": "csrf-token",
      cookie: "csrf-token=csrf-token",
    },
    body: JSON.stringify(body),
  })
}

describe("/api/conversations NSFW gating", () => {
  beforeEach(() => {
    jest.resetModules()
    jest.clearAllMocks()

    mockAuth.mockResolvedValue({ userId: "clerk-1" })
    mockUserFindUnique.mockResolvedValue({
      id: "user-1",
      email: "user@example.com",
      stripePriceId: null,
      stripeCurrentPeriodEnd: null,
      isAdult: false,
      nsfwEnabled: false,
    })
    mockCharacterFindUnique.mockResolvedValue({
      id: "11111111-1111-1111-8111-111111111111",
      name: "NSFW Character",
      isPublic: true,
      createdById: "user-2",
      isNsfw: true,
      greeting: null,
      systemPrompt: "prompt",
    })
  })

  it("blocks starting chat with NSFW character when NSFW not enabled", async () => {
    const { POST } = await import("@/app/api/conversations/route")

    const res = await POST(
      createRequest({
        isAI: true,
        characterId: "11111111-1111-1111-8111-111111111111",
      })
    )

    expect(res.status).toBe(403)
    expect(mockConversationCreate).not.toHaveBeenCalled()

    const json = (await res.json()) as { error?: string }
    expect(json.error).toMatch(/NSFW/i)
  })
})
