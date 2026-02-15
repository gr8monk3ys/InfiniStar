/**
 * @jest-environment node
 */

import { NextRequest } from "next/server"

const mockGetCurrentUser = jest.fn()
const mockSendWebPushToUser = jest.fn()

jest.mock("@/app/actions/getCurrentUser", () => ({
  __esModule: true,
  default: () => mockGetCurrentUser(),
}))

jest.mock("@/app/lib/web-push", () => ({
  sendWebPushToUser: (...args: unknown[]) => mockSendWebPushToUser(...args),
}))

function createRequest(): NextRequest {
  return new NextRequest("http://localhost:3000/api/notifications/push/test", {
    method: "POST",
    headers: {
      "X-CSRF-Token": "csrf-token",
      cookie: "csrf-token=csrf-token",
    },
  })
}

describe("POST /api/notifications/push/test", () => {
  beforeEach(() => {
    jest.resetModules()
    jest.clearAllMocks()
    mockGetCurrentUser.mockResolvedValue({ id: "user-1" })
  })

  async function runPost() {
    const { POST } = await import("@/app/api/notifications/push/test/route")
    return POST(createRequest())
  }

  it("returns 401 when signed out", async () => {
    mockGetCurrentUser.mockResolvedValue(null)
    const res = await runPost()
    expect(res.status).toBe(401)
  })

  it("returns 501 when not configured", async () => {
    mockSendWebPushToUser.mockResolvedValue({ configured: false, sent: 0, failed: 0 })
    const res = await runPost()
    expect(res.status).toBe(501)
  })

  it("returns ok when configured", async () => {
    mockSendWebPushToUser.mockResolvedValue({ configured: true, sent: 1, failed: 0 })
    const res = await runPost()
    expect(res.status).toBe(200)
    const json = (await res.json()) as { ok: boolean; sent: number; failed: number }
    expect(json.ok).toBe(true)
    expect(json.sent).toBe(1)
    expect(json.failed).toBe(0)
  })
})
