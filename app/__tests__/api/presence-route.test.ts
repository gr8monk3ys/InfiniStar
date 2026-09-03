/**
 * @jest-environment node
 */

import { NextRequest } from "next/server"

const mockGetCurrentUser = jest.fn()
const mockUserUpdate = jest.fn()
const mockLimiterCheck = jest.fn()
const mockTrigger = jest.fn()

jest.mock("@/app/actions/getCurrentUser", () => ({
  __esModule: true,
  default: () => mockGetCurrentUser(),
}))

jest.mock("@/app/lib/prismadb", () => ({
  __esModule: true,
  default: {
    user: {
      update: (args: unknown) => mockUserUpdate(args),
    },
  },
}))

jest.mock("@/app/lib/rate-limit", () => ({
  apiLimiter: { check: (...args: unknown[]) => mockLimiterCheck(...args) },
  getClientIdentifier: () => "127.0.0.1",
}))

jest.mock("@/app/lib/pusher-server", () => ({
  pusherServer: { trigger: (...args: unknown[]) => mockTrigger(...args) },
}))

/** Next always passes a context; only dynamic segments put anything in it. */
const routeCtx = () => ({ params: Promise.resolve({}) })

function createRequest(body?: unknown, csrfHeader = "presence-token"): NextRequest {
  return new NextRequest("http://localhost:3000/api/users/presence", {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      "X-CSRF-Token": csrfHeader,
      cookie: "csrf-token=presence-token",
    },
    body: body ? JSON.stringify(body) : undefined,
  })
}

async function runPatch(body?: unknown, csrfHeader?: string) {
  const { PATCH } = await import("@/app/api/users/presence/route")
  return PATCH(createRequest(body, csrfHeader), routeCtx())
}

describe("PATCH /api/users/presence", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockLimiterCheck.mockResolvedValue(true)
    mockTrigger.mockResolvedValue(undefined)
    mockGetCurrentUser.mockResolvedValue({ id: "user-1", email: "user@example.com" })
    mockUserUpdate.mockResolvedValue({
      id: "user-1",
      presenceStatus: "online",
      lastSeenAt: new Date("2026-09-01T00:00:00.000Z"),
      customStatus: null,
      customStatusEmoji: null,
    })
  })

  it("updates presence for the signed-in user", async () => {
    const res = await runPatch({ status: "online" })
    expect(res.status).toBe(200)
    const json = (await res.json()) as { user: { presenceStatus: string } }
    expect(json.user.presenceStatus).toBe("online")
    expect(mockUserUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "user-1" },
        data: expect.objectContaining({ presenceStatus: "online" }),
      })
    )
  })

  it("returns 401 when signed out", async () => {
    mockGetCurrentUser.mockResolvedValue(null)
    const res = await runPatch({ status: "online" })
    expect(res.status).toBe(401)
    expect(mockUserUpdate).not.toHaveBeenCalled()
  })

  it("returns 400 for an unknown status", async () => {
    const res = await runPatch({ status: "vibing" })
    expect(res.status).toBe(400)
    expect(mockUserUpdate).not.toHaveBeenCalled()
  })

  it("returns 403 when the CSRF token does not match the cookie", async () => {
    const res = await runPatch({ status: "online" }, "forged")
    expect(res.status).toBe(403)
    expect(mockUserUpdate).not.toHaveBeenCalled()
  })

  // The route had CSRF but no limiter: a presence heartbeat is exactly the kind
  // of endpoint a client can be made to hammer.
  it("returns 429 when the limiter refuses, before any write", async () => {
    mockLimiterCheck.mockResolvedValue(false)
    const res = await runPatch({ status: "online" })
    expect(res.status).toBe(429)
    expect(res.headers.get("Retry-After")).toBe("60")
    expect(mockUserUpdate).not.toHaveBeenCalled()
  })
})
