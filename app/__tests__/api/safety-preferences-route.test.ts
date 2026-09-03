/**
 * @jest-environment node
 */

import { NextRequest } from "next/server"

const mockGetCurrentUser = jest.fn()
const mockFindUnique = jest.fn()
const mockUpdate = jest.fn()
const mockLimiterCheck = jest.fn()

jest.mock("@/app/actions/getCurrentUser", () => ({
  __esModule: true,
  default: () => mockGetCurrentUser(),
}))

jest.mock("@/app/lib/prismadb", () => ({
  __esModule: true,
  default: {
    user: {
      findUnique: (args: unknown) => mockFindUnique(args),
      update: (args: unknown) => mockUpdate(args),
    },
  },
}))

jest.mock("@/app/lib/rate-limit", () => ({
  apiLimiter: { check: (...args: unknown[]) => mockLimiterCheck(...args) },
  getClientIdentifier: () => "127.0.0.1",
}))

/** Next always passes a context; only dynamic segments put anything in it. */
const routeCtx = () => ({ params: Promise.resolve({}) })

function createRequest(method: string, body?: unknown): NextRequest {
  return new NextRequest("http://localhost:3000/api/safety/preferences", {
    method,
    headers: {
      "Content-Type": "application/json",
      "X-CSRF-Token": "csrf-token",
      cookie: "csrf-token=csrf-token",
    },
    body: body ? JSON.stringify(body) : undefined,
  })
}

describe("/api/safety/preferences", () => {
  beforeEach(() => {
    jest.resetModules()
    jest.clearAllMocks()
    mockLimiterCheck.mockResolvedValue(true)
    mockGetCurrentUser.mockResolvedValue({ id: "user-1", email: "user@example.com" })
    mockFindUnique.mockResolvedValue({
      isAdult: false,
      adultConfirmedAt: null,
      nsfwEnabled: false,
      nsfwEnabledAt: null,
    })
    mockUpdate.mockResolvedValue({
      isAdult: true,
      adultConfirmedAt: new Date("2026-02-15T00:00:00.000Z"),
      nsfwEnabled: true,
      nsfwEnabledAt: new Date("2026-02-15T00:00:00.000Z"),
    })
  })

  async function runGet() {
    const { GET } = await import("@/app/api/safety/preferences/route")
    return GET(createRequest("GET"), routeCtx())
  }

  async function runPatch(body: unknown) {
    const { PATCH } = await import("@/app/api/safety/preferences/route")
    return PATCH(createRequest("PATCH", body), routeCtx())
  }

  it("GET returns 401 when signed out", async () => {
    mockGetCurrentUser.mockResolvedValue(null)
    const res = await runGet()
    expect(res.status).toBe(401)
  })

  it("GET returns preferences", async () => {
    const res = await runGet()
    expect(res.status).toBe(200)
    const json = (await res.json()) as {
      preferences: {
        isAdult: boolean
        adultConfirmedAt: string | null
        nsfwEnabled: boolean
        nsfwEnabledAt: string | null
      }
    }
    expect(json.preferences.isAdult).toBe(false)
    expect(json.preferences.nsfwEnabled).toBe(false)
  })

  it("PATCH returns 401 when signed out", async () => {
    mockGetCurrentUser.mockResolvedValue(null)
    const res = await runPatch({ isAdult: true })
    expect(res.status).toBe(401)
  })

  it("PATCH returns 400 for invalid payload", async () => {
    const res = await runPatch({ isAdult: "yes" })
    expect(res.status).toBe(400)
  })

  it("PATCH blocks enabling NSFW unless adult", async () => {
    mockFindUnique.mockResolvedValue({
      isAdult: false,
      adultConfirmedAt: null,
      nsfwEnabled: false,
      nsfwEnabledAt: null,
    })

    const res = await runPatch({ nsfwEnabled: true })
    expect(res.status).toBe(400)
  })

  it("PATCH updates preferences when valid", async () => {
    const res = await runPatch({ isAdult: true, nsfwEnabled: true })
    expect(res.status).toBe(200)
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "user-1" },
        data: expect.objectContaining({
          isAdult: true,
          nsfwEnabled: true,
        }),
      })
    )
  })

  it("PATCH rate-limits by the identifier the platform derives, not one the caller supplies", async () => {
    mockLimiterCheck.mockResolvedValue(false)

    const res = await runPatch({ isAdult: true })

    expect(res.status).toBe(429)
    // The guard always asks getClientIdentifier; the route no longer reads the
    // left-most (client-written) x-forwarded-for entry for itself.
    expect(mockLimiterCheck).toHaveBeenCalledWith("127.0.0.1")
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it("PATCH returns 403 when the CSRF token does not match the cookie", async () => {
    const { PATCH } = await import("@/app/api/safety/preferences/route")
    const req = new NextRequest("http://localhost:3000/api/safety/preferences", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "X-CSRF-Token": "forged-token",
        cookie: "csrf-token=real-token",
      },
      body: JSON.stringify({ isAdult: true }),
    })

    const res = await PATCH(req, routeCtx())

    expect(res.status).toBe(403)
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it("PATCH turning off adult also disables NSFW", async () => {
    mockFindUnique.mockResolvedValue({
      isAdult: true,
      adultConfirmedAt: new Date("2026-02-01T00:00:00.000Z"),
      nsfwEnabled: true,
      nsfwEnabledAt: new Date("2026-02-10T00:00:00.000Z"),
    })

    const res = await runPatch({ isAdult: false })
    expect(res.status).toBe(200)
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "user-1" },
        data: expect.objectContaining({
          isAdult: false,
          nsfwEnabled: false,
          nsfwEnabledAt: null,
        }),
      })
    )
  })
})
