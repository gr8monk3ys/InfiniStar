/**
 * @jest-environment node
 */

import { NextRequest } from "next/server"
import { auth } from "@clerk/nextjs/server"

import { verifyCsrfToken } from "@/app/lib/csrf"
import { moderateTextModelAssisted } from "@/app/lib/moderation"
import { canAccessNsfw } from "@/app/lib/nsfw"
import prisma from "@/app/lib/prismadb"
import { apiLimiter } from "@/app/lib/rate-limit"
import { GET, POST } from "@/app/api/characters/[characterId]/comments/route"

jest.mock("@clerk/nextjs/server", () => ({
  auth: jest.fn(),
}))

jest.mock("@/app/lib/prismadb", () => ({
  __esModule: true,
  default: {
    user: {
      findUnique: jest.fn(),
    },
    character: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    characterComment: {
      findMany: jest.fn(),
      create: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}))

jest.mock("@/app/lib/rate-limit", () => ({
  apiLimiter: { check: jest.fn(() => true) },
  getClientIdentifier: jest.fn(() => "127.0.0.1"),
}))

jest.mock("@/app/lib/csrf", () => ({
  verifyCsrfToken: jest.fn(() => true),
}))

jest.mock("@/app/lib/moderation", () => ({
  moderateTextModelAssisted: jest.fn(async () => ({ shouldBlock: false, categories: [] })),
}))

jest.mock("@/app/lib/nsfw", () => ({
  canAccessNsfw: jest.fn(() => true),
}))

function createRequest(method: string, body?: unknown) {
  return new NextRequest("http://localhost:3000/api/characters/char-1/comments", {
    method,
    headers: {
      "Content-Type": "application/json",
      "X-CSRF-Token": "test-token",
      cookie: "csrf-token=test-token",
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
}

const mockAuth = auth as unknown as jest.Mock

beforeEach(() => {
  jest.clearAllMocks()
  ;(apiLimiter.check as jest.Mock).mockReturnValue(true)
  ;(verifyCsrfToken as jest.Mock).mockReturnValue(true)
  ;(moderateTextModelAssisted as jest.Mock).mockResolvedValue({
    shouldBlock: false,
    categories: [],
  })
  ;(canAccessNsfw as jest.Mock).mockReturnValue(true)
  mockAuth.mockResolvedValue({ userId: null })
})

describe("GET /api/characters/[characterId]/comments", () => {
  it("returns 404 when character is missing", async () => {
    ;(prisma.character.findUnique as jest.Mock).mockResolvedValue(null)
    ;(prisma.characterComment.findMany as jest.Mock).mockResolvedValue([])

    const response = await GET(createRequest("GET"), {
      params: Promise.resolve({ characterId: "11111111-1111-1111-8111-111111111111" }),
    })

    expect(response.status).toBe(404)
  })
})

describe("POST /api/characters/[characterId]/comments", () => {
  it("creates a comment", async () => {
    mockAuth.mockResolvedValue({ userId: "clerk-user-1" })
    ;(prisma.user.findUnique as jest.Mock).mockResolvedValue({
      id: "user-1",
      isAdult: true,
      nsfwEnabled: true,
    })
    ;(prisma.character.findUnique as jest.Mock).mockResolvedValue({
      id: "char-1",
      isPublic: true,
      isNsfw: false,
    })
    ;(prisma.characterComment.create as jest.Mock).mockReturnValue("op-create")
    ;(prisma.character.update as jest.Mock).mockReturnValue("op-update")
    ;(prisma.$transaction as jest.Mock).mockResolvedValue([
      {
        id: "comment-1",
        body: "Nice character!",
        createdAt: new Date("2026-02-15T00:00:00.000Z"),
        author: { id: "user-1", name: "Test", image: null },
      },
      { commentCount: 1 },
    ])

    const response = await POST(createRequest("POST", { body: "Nice character!" }), {
      params: Promise.resolve({ characterId: "11111111-1111-1111-8111-111111111111" }),
    })
    const json = (await response.json()) as { comment?: unknown; commentCount?: number }

    expect(response.status).toBe(201)
    expect(prisma.$transaction).toHaveBeenCalled()
    expect(json.commentCount).toBe(1)
    expect(json.comment).toBeTruthy()
  })
})
