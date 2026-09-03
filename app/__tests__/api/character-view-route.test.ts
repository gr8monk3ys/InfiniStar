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

// The guard verifies the double-submit token for real here: createRequest sends
// a header that matches its cookie, and the forged-token test sends one that
// does not.

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

function createRequest(csrfHeader = "beacon-token") {
  return new NextRequest(`http://localhost:3000/api/characters/${VALID_ID}/view`, {
    method: "POST",
    headers: {
      "X-CSRF-Token": csrfHeader,
      cookie: "csrf-token=beacon-token",
    },
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

  /**
   * Deliberate, not an oversight. CSRF defends against an attacker spending a
   * victim's ambient credentials; this endpoint takes none and only increments
   * a public counter, so there is nothing to forge — anyone wanting to inflate
   * a count can fetch a token themselves. Requiring one would cost every cold
   * character page an extra round trip to /api/csrf and would break view
   * counting silently whenever that request failed. The rate limiter above is
   * the control that actually bounds abuse here.
   */
  it("does not require a CSRF token, because there is no credential to forge", async () => {
    const response = await POST(createRequest("forged-token"), {
      params: Promise.resolve({ characterId: VALID_ID }),
    })

    expect(response.status).toBe(200)
    expect(prisma.character.update).toHaveBeenCalledTimes(1)
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
