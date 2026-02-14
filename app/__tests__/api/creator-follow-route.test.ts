/**
 * @jest-environment node
 */

import { NextRequest } from "next/server"

import { verifyCsrfToken } from "@/app/lib/csrf"
import prisma from "@/app/lib/prismadb"
import { apiLimiter } from "@/app/lib/rate-limit"
import getCurrentUser from "@/app/actions/getCurrentUser"
import { DELETE, GET, POST } from "@/app/api/creators/[creatorId]/follow/route"

jest.mock("@/app/lib/prismadb", () => ({
  __esModule: true,
  default: {
    userFollow: {
      count: jest.fn(),
      findUnique: jest.fn(),
      upsert: jest.fn(),
      deleteMany: jest.fn(),
    },
  },
}))

jest.mock("@/app/lib/rate-limit", () => ({
  apiLimiter: { check: jest.fn(() => true) },
  getClientIdentifier: jest.fn(() => "127.0.0.1"),
}))

jest.mock("@/app/lib/csrf", () => ({
  verifyCsrfToken: jest.fn(() => true),
}))

jest.mock("@/app/actions/getCurrentUser", () => ({
  __esModule: true,
  default: jest.fn(() => Promise.resolve({ id: "user-1" })),
}))

function createRequest(
  method: string,
  url = "http://localhost:3000/api/creators/creator-1/follow"
) {
  return new NextRequest(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      "X-CSRF-Token": "test-token",
      cookie: "csrf-token=test-token",
    },
  })
}

beforeEach(() => {
  jest.clearAllMocks()
  ;(apiLimiter.check as jest.Mock).mockReturnValue(true)
  ;(verifyCsrfToken as jest.Mock).mockReturnValue(true)
  ;(getCurrentUser as jest.Mock).mockResolvedValue({ id: "user-1" })
  ;(prisma.userFollow.count as jest.Mock).mockResolvedValue(0)
  ;(prisma.userFollow.findUnique as jest.Mock).mockResolvedValue(null)
})

describe("GET /api/creators/[creatorId]/follow", () => {
  it("returns followerCount and isFollowing=false when signed out", async () => {
    ;(getCurrentUser as jest.Mock).mockResolvedValue(null)
    ;(prisma.userFollow.count as jest.Mock).mockResolvedValue(12)

    const request = createRequest("GET")
    const response = await GET(request, { params: Promise.resolve({ creatorId: "creator-1" }) })
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toEqual({ isFollowing: false, followerCount: 12 })
  })
})

describe("POST /api/creators/[creatorId]/follow", () => {
  it("follows a creator", async () => {
    ;(prisma.userFollow.count as jest.Mock).mockResolvedValue(3)

    const request = createRequest("POST")
    const response = await POST(request, { params: Promise.resolve({ creatorId: "creator-2" }) })
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(prisma.userFollow.upsert).toHaveBeenCalled()
    expect(body).toEqual({ isFollowing: true, followerCount: 3 })
  })

  it("rejects invalid CSRF token", async () => {
    ;(verifyCsrfToken as jest.Mock).mockReturnValue(false)

    const request = createRequest("POST")
    const response = await POST(request, { params: Promise.resolve({ creatorId: "creator-2" }) })

    expect(response.status).toBe(403)
  })

  it("prevents self-follow", async () => {
    const request = createRequest("POST")
    const response = await POST(request, { params: Promise.resolve({ creatorId: "user-1" }) })

    expect(response.status).toBe(400)
  })
})

describe("DELETE /api/creators/[creatorId]/follow", () => {
  it("unfollows a creator", async () => {
    ;(prisma.userFollow.count as jest.Mock).mockResolvedValue(1)

    const request = createRequest("DELETE")
    const response = await DELETE(request, { params: Promise.resolve({ creatorId: "creator-2" }) })
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(prisma.userFollow.deleteMany).toHaveBeenCalled()
    expect(body).toEqual({ isFollowing: false, followerCount: 1 })
  })
})
