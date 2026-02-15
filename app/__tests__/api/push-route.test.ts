/**
 * @jest-environment node
 */

import { NextRequest } from "next/server"

const mockGetCurrentUser = jest.fn()
const mockCount = jest.fn()
const mockUpsert = jest.fn()
const mockDeleteMany = jest.fn()

jest.mock("@/app/actions/getCurrentUser", () => ({
  __esModule: true,
  default: () => mockGetCurrentUser(),
}))

jest.mock("@/app/lib/prismadb", () => ({
  __esModule: true,
  default: {
    pushSubscription: {
      count: (args: unknown) => mockCount(args),
      upsert: (args: unknown) => mockUpsert(args),
      deleteMany: (args: unknown) => mockDeleteMany(args),
    },
  },
}))

jest.mock("@/app/lib/web-push", () => ({
  getVapidPublicKey: () => "test-public-key",
}))

function createRequest(url: string, method: string, body?: unknown): NextRequest {
  return new NextRequest(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      "X-CSRF-Token": "csrf-token",
      cookie: "csrf-token=csrf-token",
    },
    body: body ? JSON.stringify(body) : undefined,
  })
}

describe("/api/notifications/push", () => {
  const originalEnv = process.env

  beforeEach(() => {
    jest.resetModules()
    jest.clearAllMocks()
    process.env = { ...originalEnv, VAPID_PRIVATE_KEY: "test-private-key" }
    mockGetCurrentUser.mockResolvedValue({ id: "user-1", email: "user@example.com" })
    mockCount.mockResolvedValue(2)
    mockUpsert.mockResolvedValue({ id: "sub-1" })
    mockDeleteMany.mockResolvedValue({ count: 1 })
  })

  afterAll(() => {
    process.env = originalEnv
  })

  async function runGet() {
    const { GET } = await import("@/app/api/notifications/push/route")
    return GET(createRequest("http://localhost:3000/api/notifications/push", "GET"))
  }

  async function runPost(body: unknown) {
    const { POST } = await import("@/app/api/notifications/push/route")
    return POST(createRequest("http://localhost:3000/api/notifications/push", "POST", body))
  }

  async function runDelete(body?: unknown) {
    const { DELETE } = await import("@/app/api/notifications/push/route")
    return DELETE(
      createRequest("http://localhost:3000/api/notifications/push", "DELETE", body as unknown)
    )
  }

  it("GET returns 401 when signed out", async () => {
    mockGetCurrentUser.mockResolvedValue(null)
    const res = await runGet()
    expect(res.status).toBe(401)
  })

  it("GET returns configured and subscriptionCount", async () => {
    const res = await runGet()
    expect(res.status).toBe(200)
    const json = (await res.json()) as {
      configured: boolean
      publicKey: string
      subscriptionCount: number
    }
    expect(json.configured).toBe(true)
    expect(json.publicKey).toBe("test-public-key")
    expect(json.subscriptionCount).toBe(2)
  })

  it("POST returns 401 when signed out", async () => {
    mockGetCurrentUser.mockResolvedValue(null)
    const res = await runPost({ subscription: {} })
    expect(res.status).toBe(401)
  })

  it("POST returns 400 for invalid payload", async () => {
    const res = await runPost({ subscription: { endpoint: "nope" } })
    expect(res.status).toBe(400)
  })

  it("POST upserts subscription", async () => {
    const res = await runPost({
      subscription: {
        endpoint: "https://example.com/push/1",
        keys: { p256dh: "p256", auth: "auth" },
      },
      userAgent: "jest",
    })

    expect(res.status).toBe(200)
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { endpoint: "https://example.com/push/1" },
        create: expect.objectContaining({
          endpoint: "https://example.com/push/1",
          p256dh: "p256",
          auth: "auth",
        }),
        update: expect.objectContaining({
          userId: "user-1",
          p256dh: "p256",
          auth: "auth",
        }),
      })
    )
  })

  it("DELETE deletes by endpoint when provided", async () => {
    const res = await runDelete({ endpoint: "https://example.com/push/1" })
    expect(res.status).toBe(200)
    expect(mockDeleteMany).toHaveBeenCalledWith({
      where: { userId: "user-1", endpoint: "https://example.com/push/1" },
    })
  })

  it("DELETE deletes all when body omitted", async () => {
    const { DELETE } = await import("@/app/api/notifications/push/route")
    const req = new NextRequest("http://localhost:3000/api/notifications/push", {
      method: "DELETE",
      headers: {
        "X-CSRF-Token": "csrf-token",
        cookie: "csrf-token=csrf-token",
      },
    })

    const res = await DELETE(req)
    expect(res.status).toBe(200)
    expect(mockDeleteMany).toHaveBeenCalledWith({ where: { userId: "user-1" } })
  })
})
