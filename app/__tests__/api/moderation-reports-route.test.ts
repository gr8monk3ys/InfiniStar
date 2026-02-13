/**
 * @jest-environment node
 */

import { NextRequest } from "next/server"

const mockAuth = jest.fn()
const mockVerifyCsrfToken = jest.fn()
const mockFindUser = jest.fn()
const mockFindMany = jest.fn()
const mockCreate = jest.fn()
const mockFindUnique = jest.fn()
const mockUpdate = jest.fn()
const mockSanitizePlainText = jest.fn((value: string) => value)

jest.mock("@clerk/nextjs/server", () => ({
  auth: () => mockAuth(),
}))

jest.mock("@/app/lib/csrf", () => ({
  verifyCsrfToken: (headerToken: string | null, cookieToken: string | null) =>
    mockVerifyCsrfToken(headerToken, cookieToken),
}))

jest.mock("@/app/lib/sanitize", () => ({
  sanitizePlainText: (value: string) => mockSanitizePlainText(value),
}))

jest.mock("@/app/lib/prismadb", () => ({
  __esModule: true,
  default: {
    user: {
      findUnique: (args: unknown) => mockFindUser(args),
    },
    contentReport: {
      findMany: (args: unknown) => mockFindMany(args),
      create: (args: unknown) => mockCreate(args),
      findUnique: (args: unknown) => mockFindUnique(args),
      update: (args: unknown) => mockUpdate(args),
    },
  },
}))

function createRequest(method: string, path: string, body?: object): NextRequest {
  const headers: Record<string, string> = {
    cookie: "csrf-token=test-token",
    "X-CSRF-Token": "test-token",
  }

  const init: ConstructorParameters<typeof NextRequest>[1] = {
    method,
    headers,
  }

  if (body !== undefined) {
    headers["Content-Type"] = "application/json"
    init.body = JSON.stringify(body)
  }

  return new NextRequest(`http://localhost:3000${path}`, init)
}

describe("api/moderation/reports route", () => {
  const originalEnv = process.env
  const reviewerId = "reviewer-user-id"
  const reviewerEmail = "reviewer@example.com"
  const standardUserId = "standard-user-id"
  const standardEmail = "member@example.com"

  beforeEach(() => {
    jest.clearAllMocks()
    process.env = {
      ...originalEnv,
      MODERATION_REVIEWER_EMAILS: reviewerEmail,
    }

    mockAuth.mockResolvedValue({ userId: "clerk_123" })
    mockVerifyCsrfToken.mockReturnValue(true)
    mockSanitizePlainText.mockImplementation((value: string) => value.trim())
    mockFindUser.mockResolvedValue({
      id: standardUserId,
      email: standardEmail,
    })
  })

  afterAll(() => {
    process.env = originalEnv
  })

  async function runGet(path: string = "/api/moderation/reports") {
    const { GET } = await import("@/app/api/moderation/reports/route")
    return GET(createRequest("GET", path))
  }

  async function runPost(body: object) {
    const { POST } = await import("@/app/api/moderation/reports/route")
    return POST(createRequest("POST", "/api/moderation/reports", body))
  }

  async function runPatch(body: object) {
    const { PATCH } = await import("@/app/api/moderation/reports/route")
    return PATCH(createRequest("PATCH", "/api/moderation/reports", body))
  }

  it("returns reports scoped to the current user for non-reviewers", async () => {
    mockFindMany.mockResolvedValue([
      {
        id: "report-1",
        reporterId: standardUserId,
        status: "OPEN",
      },
    ])

    const response = await runGet("/api/moderation/reports?status=OPEN&limit=50")

    expect(response.status).toBe(200)
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          reporterId: standardUserId,
          status: "OPEN",
        }),
      })
    )

    const payload = await response.json()
    expect(payload.canReviewAll).toBe(false)
  })

  it("returns all reports for reviewer allowlist users", async () => {
    mockFindUser.mockResolvedValue({
      id: reviewerId,
      email: reviewerEmail,
    })
    mockFindMany.mockResolvedValue([])

    const response = await runGet("/api/moderation/reports?targetType=MESSAGE&limit=25")

    expect(response.status).toBe(200)
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.not.objectContaining({
          reporterId: expect.anything(),
        }),
      })
    )

    const payload = await response.json()
    expect(payload.canReviewAll).toBe(true)
  })

  it("creates reports for authenticated users with valid CSRF tokens", async () => {
    mockCreate.mockResolvedValue({ id: "new-report-id" })

    const response = await runPost({
      targetType: "MESSAGE",
      targetId: "msg-123",
      reason: "SPAM",
      details: "Repeated scam links in chat.",
    })

    expect(response.status).toBe(201)
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          reporterId: standardUserId,
          targetType: "MESSAGE",
          targetId: "msg-123",
          reason: "SPAM",
          details: "Repeated scam links in chat.",
        }),
      })
    )
  })

  it("rejects report creation when CSRF validation fails", async () => {
    mockVerifyCsrfToken.mockReturnValue(false)

    const response = await runPost({
      targetType: "MESSAGE",
      targetId: "msg-123",
      reason: "SPAM",
    })

    expect(response.status).toBe(403)
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it("forbids status updates for users outside the reviewer allowlist", async () => {
    const response = await runPatch({
      reportId: "c5ad7188-e37d-4eb0-b2e9-bdce6cfc96ff",
      status: "REVIEWING",
    })

    expect(response.status).toBe(403)
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it("allows reviewer allowlist users to resolve reports", async () => {
    mockFindUser.mockResolvedValue({
      id: reviewerId,
      email: reviewerEmail,
    })
    mockFindUnique.mockResolvedValue({
      id: "c5ad7188-e37d-4eb0-b2e9-bdce6cfc96ff",
      details: "Original report context.",
    })
    mockUpdate.mockResolvedValue({
      id: "c5ad7188-e37d-4eb0-b2e9-bdce6cfc96ff",
      status: "RESOLVED",
    })

    const response = await runPatch({
      reportId: "c5ad7188-e37d-4eb0-b2e9-bdce6cfc96ff",
      status: "RESOLVED",
      resolutionNote: "  Confirmed and actioned.  ",
    })

    expect(response.status).toBe(200)
    expect(mockSanitizePlainText).toHaveBeenCalledWith("  Confirmed and actioned.  ")
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: "c5ad7188-e37d-4eb0-b2e9-bdce6cfc96ff",
        },
        data: expect.objectContaining({
          status: "RESOLVED",
          resolvedBy: reviewerId,
          resolvedAt: expect.any(Date),
          details: expect.stringContaining("Reviewer note: Confirmed and actioned."),
        }),
      })
    )
  })

  it("returns 404 when reviewer updates a missing report", async () => {
    mockFindUser.mockResolvedValue({
      id: reviewerId,
      email: reviewerEmail,
    })
    mockFindUnique.mockResolvedValue(null)

    const response = await runPatch({
      reportId: "f309f68f-b5d5-4325-91d1-96b4075267e1",
      status: "DISMISSED",
    })

    expect(response.status).toBe(404)
    expect(mockUpdate).not.toHaveBeenCalled()
  })
})

export {}
