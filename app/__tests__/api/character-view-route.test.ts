/**
 * @jest-environment node
 */

import { NextRequest } from "next/server"

import prisma from "@/app/lib/prismadb"
import { apiLimiter } from "@/app/lib/rate-limit"
import { POST } from "@/app/api/characters/[characterId]/view/route"

jest.mock("@/app/lib/prismadb", () => ({
  __esModule: true,
  default: {
    character: {
      update: jest.fn(),
    },
  },
}))

jest.mock("@/app/lib/rate-limit", () => ({
  apiLimiter: { check: jest.fn(() => true) },
  getClientIdentifier: jest.fn(() => "127.0.0.1"),
}))

jest.mock("@/app/lib/logger", () => ({
  __esModule: true,
  default: {
    child: jest.fn(() => ({
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    })),
  },
  apiLogger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
  aiLogger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
  authLogger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}))

const VALID_ID = "11111111-1111-4111-8111-111111111111"

function createRequest() {
  return new NextRequest(`http://localhost:3000/api/characters/${VALID_ID}/view`, {
    method: "POST",
  })
}

beforeEach(() => {
  jest.clearAllMocks()
  ;(apiLimiter.check as jest.Mock).mockReturnValue(true)
  ;(prisma.character.update as jest.Mock).mockResolvedValue({ id: VALID_ID })
})

describe("POST /api/characters/[characterId]/view", () => {
  it("increments viewCount exactly once and returns 200", async () => {
    const response = await POST(createRequest(), {
      params: Promise.resolve({ characterId: VALID_ID }),
    })

    expect(response.status).toBe(200)
    expect(prisma.character.update).toHaveBeenCalledTimes(1)
    expect(prisma.character.update).toHaveBeenCalledWith({
      where: { id: VALID_ID },
      data: { viewCount: { increment: 1 } },
    })
  })

  it("rejects an invalid characterId without touching the database", async () => {
    const response = await POST(createRequest(), {
      params: Promise.resolve({ characterId: "not-a-uuid" }),
    })

    expect(response.status).toBe(400)
    expect(prisma.character.update).not.toHaveBeenCalled()
  })

  it("returns 429 and skips the increment when rate limited", async () => {
    ;(apiLimiter.check as jest.Mock).mockReturnValue(false)

    const response = await POST(createRequest(), {
      params: Promise.resolve({ characterId: VALID_ID }),
    })

    expect(response.status).toBe(429)
    expect(prisma.character.update).not.toHaveBeenCalled()
  })

  it("returns 200 (fire-and-forget) when the record does not exist", async () => {
    const notFound = Object.assign(new Error("Record to update not found."), {
      code: "P2025",
    })
    ;(prisma.character.update as jest.Mock).mockRejectedValue(notFound)

    const response = await POST(createRequest(), {
      params: Promise.resolve({ characterId: VALID_ID }),
    })

    expect(response.status).toBe(200)
  })
})
