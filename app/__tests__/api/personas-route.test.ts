/**
 * @jest-environment node
 */

import { NextRequest } from "next/server"

const mockGetCurrentUser = jest.fn()
const mockFindMany = jest.fn()
const mockCount = jest.fn()
const mockUpdateMany = jest.fn()
const mockCreate = jest.fn()
const mockLimiterCheck = jest.fn()

jest.mock("@/app/actions/getCurrentUser", () => ({
  __esModule: true,
  default: () => mockGetCurrentUser(),
}))

jest.mock("@/app/lib/prismadb", () => ({
  __esModule: true,
  default: {
    userPersona: {
      findMany: (args: unknown) => mockFindMany(args),
      count: (args: unknown) => mockCount(args),
      updateMany: (args: unknown) => mockUpdateMany(args),
      create: (args: unknown) => mockCreate(args),
    },
  },
}))

jest.mock("@/app/lib/rate-limit", () => ({
  apiLimiter: { check: (...args: unknown[]) => mockLimiterCheck(...args) },
  getClientIdentifier: () => "127.0.0.1",
}))

/** Next always passes a context; only dynamic segments put anything in it. */
const routeCtx = () => ({ params: Promise.resolve({}) })

function createRequest(method: string, body?: unknown, csrfHeader = "persona-token"): NextRequest {
  return new NextRequest("http://localhost:3000/api/personas", {
    method,
    headers: {
      "Content-Type": "application/json",
      "X-CSRF-Token": csrfHeader,
      cookie: "csrf-token=persona-token",
    },
    body: body ? JSON.stringify(body) : undefined,
  })
}

describe("/api/personas", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockLimiterCheck.mockResolvedValue(true)
    mockGetCurrentUser.mockResolvedValue({ id: "user-1", email: "user@example.com" })
    mockFindMany.mockResolvedValue([{ id: "persona-1", name: "Nyra" }])
    mockCount.mockResolvedValue(0)
    mockCreate.mockResolvedValue({ id: "persona-1", name: "Nyra" })
  })

  async function runGet() {
    const { GET } = await import("@/app/api/personas/route")
    return GET(createRequest("GET"), routeCtx())
  }

  async function runPost(body: unknown) {
    const { POST } = await import("@/app/api/personas/route")
    return POST(createRequest("POST", body), routeCtx())
  }

  it("GET returns the current user's personas", async () => {
    const res = await runGet()
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual([{ id: "persona-1", name: "Nyra" }])
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: "user-1" } })
    )
  })

  it("GET returns 401 when signed out", async () => {
    mockGetCurrentUser.mockResolvedValue(null)
    const res = await runGet()
    expect(res.status).toBe(401)
    expect(await res.json()).toEqual({ error: "Unauthorized" })
  })

  // GET had no limiter before the guard: a signed-in caller could list personas
  // as fast as the database would answer.
  it("GET returns 429 when the limiter refuses, without querying", async () => {
    mockLimiterCheck.mockResolvedValue(false)
    const res = await runGet()
    expect(res.status).toBe(429)
    expect(mockFindMany).not.toHaveBeenCalled()
  })

  it("POST creates a persona", async () => {
    const res = await runPost({ name: "Nyra", description: "A quiet archivist." })
    expect(res.status).toBe(201)
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ name: "Nyra", userId: "user-1" }),
      })
    )
  })

  it("POST returns 400 when the name is missing", async () => {
    const res = await runPost({ description: "No name" })
    expect(res.status).toBe(400)
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it("POST returns 400 at the persona cap", async () => {
    mockCount.mockResolvedValue(20)
    const res = await runPost({ name: "One too many" })
    expect(res.status).toBe(400)
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it("POST returns 403 when the CSRF token does not match the cookie", async () => {
    const { POST } = await import("@/app/api/personas/route")
    const res = await POST(createRequest("POST", { name: "Nyra" }, "forged"), routeCtx())
    expect(res.status).toBe(403)
    expect(mockCreate).not.toHaveBeenCalled()
  })
})
