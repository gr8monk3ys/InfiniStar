/**
 * @jest-environment node
 */

import { NextRequest } from "next/server"
import { auth } from "@clerk/nextjs/server"

import { verifyCsrfToken } from "@/app/lib/csrf"
import prisma from "@/app/lib/prismadb"
import { apiLimiter } from "@/app/lib/rate-limit"
import { DELETE } from "@/app/api/character-comments/[commentId]/route"

jest.mock("@clerk/nextjs/server", () => ({
  auth: jest.fn(),
}))

jest.mock("@/app/lib/rate-limit", () => ({
  apiLimiter: { check: jest.fn(() => true) },
  getClientIdentifier: jest.fn(() => "127.0.0.1"),
}))

jest.mock("@/app/lib/csrf", () => ({
  verifyCsrfToken: jest.fn(() => true),
}))

jest.mock("@/app/lib/prismadb", () => ({
  __esModule: true,
  default: {
    user: { findUnique: jest.fn() },
    characterComment: { findUnique: jest.fn(), delete: jest.fn() },
    character: { update: jest.fn(), updateMany: jest.fn() },
    $transaction: jest.fn(),
  },
}))

function createRequest(): NextRequest {
  return new NextRequest("http://localhost:3000/api/character-comments/comment-1", {
    method: "DELETE",
    headers: {
      "X-CSRF-Token": "test-token",
      cookie: "csrf-token=test-token",
    },
  })
}

const mockAuth = auth as unknown as jest.Mock

beforeEach(() => {
  jest.clearAllMocks()
  ;(apiLimiter.check as jest.Mock).mockReturnValue(true)
  ;(verifyCsrfToken as jest.Mock).mockReturnValue(true)
  mockAuth.mockResolvedValue({ userId: "clerk-user-1" })
  ;(prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: "user-1" })
  ;(prisma.characterComment.findUnique as jest.Mock).mockResolvedValue({
    id: "comment-1",
    authorId: "user-1",
    characterId: "char-1",
    character: { createdById: "user-2" },
  })
  ;(prisma.characterComment.delete as jest.Mock).mockReturnValue("op-delete")
  ;(prisma.character.update as jest.Mock).mockReturnValue("op-decrement")
  ;(prisma.character.updateMany as jest.Mock).mockReturnValue("op-clamp")
  ;(prisma.$transaction as jest.Mock).mockResolvedValue([{}, {}, { count: 1 }])
})

describe("DELETE /api/character-comments/[commentId]", () => {
  it("clamps commentCount to prevent negative values", async () => {
    const res = await DELETE(createRequest(), {
      params: Promise.resolve({ commentId: "comment-1" }),
    })

    expect(res.status).toBe(200)
    expect(prisma.character.updateMany).toHaveBeenCalledWith({
      where: { id: "char-1", commentCount: { lt: 0 } },
      data: { commentCount: 0 },
    })
  })
})
