/**
 * @jest-environment node
 */

/**
 * API Route Tests: Account Deletion
 *
 * Tests DELETE /api/account
 *       POST  /api/account/cancel-deletion
 */

import { NextRequest } from "next/server"

import { verifyCsrfToken } from "@/app/lib/csrf"
import { sendAccountDeletionCancelledEmail, sendAccountDeletionPendingEmail } from "@/app/lib/email"
import prisma from "@/app/lib/prismadb"
import { accountDeletionLimiter } from "@/app/lib/rate-limit"
import getCurrentUser from "@/app/actions/getCurrentUser"
import { POST as cancelPOST } from "@/app/api/account/cancel-deletion/route"
import { DELETE as accountDELETE } from "@/app/api/account/route"

// ---- Mocks ----

jest.mock("@/app/lib/prismadb", () => ({
  __esModule: true,
  default: {
    user: { update: jest.fn(), findUnique: jest.fn() },
  },
}))

jest.mock("@/app/lib/csrf", () => ({
  verifyCsrfToken: jest.fn(() => true),
  getCsrfTokenFromRequest: jest.fn(() => "test-cookie-token"),
}))

jest.mock("@/app/lib/rate-limit", () => ({
  accountDeletionLimiter: { check: jest.fn(() => true) },
  getClientIdentifier: jest.fn(() => "127.0.0.1"),
}))

jest.mock("@/app/lib/email", () => ({
  sendAccountDeletionPendingEmail: jest.fn(() => Promise.resolve()),
  sendAccountDeletionCancelledEmail: jest.fn(() => Promise.resolve()),
}))

jest.mock("@/app/actions/getCurrentUser", () => ({
  __esModule: true,
  default: jest.fn(),
}))

// ---- Helpers ----

const USER_ID = "11111111-1111-4111-8111-111111111111"
const baseUser = {
  id: USER_ID,
  email: "user@example.com",
  name: "Alice",
  deletionRequested: false,
  deletionScheduledFor: null,
}

function makeDELETERequest(body: object): NextRequest {
  return new NextRequest("http://localhost:3000/api/account", {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
      "X-CSRF-Token": "test-csrf-token",
      cookie: "csrf-token=test-csrf-token",
    },
    body: JSON.stringify(body),
  })
}

function makeCancelRequest(): NextRequest {
  return new NextRequest("http://localhost:3000/api/account/cancel-deletion", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-CSRF-Token": "test-csrf-token",
      cookie: "csrf-token=test-csrf-token",
    },
    body: JSON.stringify({}),
  })
}

// ---- Tests ----

beforeEach(() => {
  jest.clearAllMocks()
  ;(getCurrentUser as jest.Mock).mockResolvedValue(baseUser)
  ;(verifyCsrfToken as jest.Mock).mockReturnValue(true)
  ;(accountDeletionLimiter.check as jest.Mock).mockReturnValue(true)
  ;(prisma.user.update as jest.Mock).mockResolvedValue({
    id: USER_ID,
    email: "user@example.com",
    name: "Alice",
    deletionScheduledFor: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  })
  ;(prisma.user.findUnique as jest.Mock).mockResolvedValue({
    deletionRequested: true,
    deletionScheduledFor: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  })
})

// ====================================================================
// DELETE /api/account
// ====================================================================

describe("DELETE /api/account", () => {
  it("returns 401 when not authenticated", async () => {
    ;(getCurrentUser as jest.Mock).mockResolvedValue(null)

    const response = await accountDELETE(makeDELETERequest({ confirmationText: "DELETE" }))
    expect(response.status).toBe(401)
  })

  it("returns 401 when user has no email", async () => {
    ;(getCurrentUser as jest.Mock).mockResolvedValue({ id: USER_ID, email: null })

    const response = await accountDELETE(makeDELETERequest({ confirmationText: "DELETE" }))
    expect(response.status).toBe(401)
  })

  it("returns 403 when CSRF token is invalid", async () => {
    ;(verifyCsrfToken as jest.Mock).mockReturnValue(false)

    const response = await accountDELETE(makeDELETERequest({ confirmationText: "DELETE" }))
    expect(response.status).toBe(403)
    const data = await response.json()
    expect(data.code).toBe("CSRF_INVALID")
  })

  it("returns 429 when rate limited", async () => {
    ;(accountDeletionLimiter.check as jest.Mock).mockReturnValue(false)

    const response = await accountDELETE(makeDELETERequest({ confirmationText: "DELETE" }))
    expect(response.status).toBe(429)
    const data = await response.json()
    expect(data.code).toBe("RATE_LIMITED")
  })

  it("returns 400 when confirmation text is wrong", async () => {
    const response = await accountDELETE(makeDELETERequest({ confirmationText: "delete" }))
    expect(response.status).toBe(400)
    const data = await response.json()
    expect(data.code).toBe("VALIDATION_ERROR")
  })

  it("returns 400 when deletion is already pending", async () => {
    ;(getCurrentUser as jest.Mock).mockResolvedValue({
      ...baseUser,
      deletionRequested: true,
      deletionScheduledFor: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    })

    const response = await accountDELETE(makeDELETERequest({ confirmationText: "DELETE" }))
    expect(response.status).toBe(400)
    const data = await response.json()
    expect(data.code).toBe("DELETION_ALREADY_PENDING")
  })

  it("creates deletion request with 30-day scheduled date", async () => {
    const now = Date.now()
    const response = await accountDELETE(makeDELETERequest({ confirmationText: "DELETE" }))
    expect(response.status).toBe(200)

    const data = await response.json()
    expect(data.success).toBe(true)
    expect(data.gracePeriodDays).toBe(30)
    expect(data.deletionScheduledFor).toBeDefined()

    // Scheduled date should be approximately 30 days from now
    const scheduledDate = new Date(data.deletionScheduledFor).getTime()
    const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000
    expect(scheduledDate).toBeGreaterThanOrEqual(now + thirtyDaysMs - 5000)

    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: USER_ID },
        data: expect.objectContaining({
          deletionRequested: true,
          deletionCancelledAt: null,
        }),
      })
    )
  })

  it("sends a pending email notification after creating deletion request", async () => {
    await accountDELETE(makeDELETERequest({ confirmationText: "DELETE" }))

    expect(sendAccountDeletionPendingEmail).toHaveBeenCalledWith(
      "user@example.com",
      "Alice",
      expect.any(Date)
    )
  })
})

// ====================================================================
// POST /api/account/cancel-deletion
// ====================================================================

describe("POST /api/account/cancel-deletion", () => {
  it("returns 401 when not authenticated", async () => {
    ;(getCurrentUser as jest.Mock).mockResolvedValue(null)

    const response = await cancelPOST(makeCancelRequest())
    expect(response.status).toBe(401)
  })

  it("returns 403 when CSRF token is invalid", async () => {
    ;(verifyCsrfToken as jest.Mock).mockReturnValue(false)

    const response = await cancelPOST(makeCancelRequest())
    expect(response.status).toBe(403)
    const data = await response.json()
    expect(data.code).toBe("CSRF_INVALID")
  })

  it("returns 429 when rate limited", async () => {
    ;(accountDeletionLimiter.check as jest.Mock).mockReturnValue(false)

    const response = await cancelPOST(makeCancelRequest())
    expect(response.status).toBe(429)
  })

  it("returns 404 when user not found in database", async () => {
    ;(prisma.user.findUnique as jest.Mock).mockResolvedValue(null)

    const response = await cancelPOST(makeCancelRequest())
    expect(response.status).toBe(404)
    const data = await response.json()
    expect(data.code).toBe("USER_NOT_FOUND")
  })

  it("returns 400 when no deletion is pending", async () => {
    ;(prisma.user.findUnique as jest.Mock).mockResolvedValue({
      deletionRequested: false,
      deletionScheduledFor: null,
    })

    const response = await cancelPOST(makeCancelRequest())
    expect(response.status).toBe(400)
    const data = await response.json()
    expect(data.code).toBe("NO_PENDING_DELETION")
  })

  it("returns 400 when grace period has already expired", async () => {
    // Set deletionScheduledFor to past date
    ;(prisma.user.findUnique as jest.Mock).mockResolvedValue({
      deletionRequested: true,
      deletionScheduledFor: new Date(Date.now() - 1000), // 1 second ago
    })

    const response = await cancelPOST(makeCancelRequest())
    expect(response.status).toBe(400)
    const data = await response.json()
    expect(data.code).toBe("GRACE_PERIOD_EXPIRED")
  })

  it("cancels pending deletion successfully", async () => {
    ;(prisma.user.update as jest.Mock).mockResolvedValue({
      id: USER_ID,
      email: "user@example.com",
      name: "Alice",
    })

    const response = await cancelPOST(makeCancelRequest())
    expect(response.status).toBe(200)

    const data = await response.json()
    expect(data.success).toBe(true)
    expect(data.message).toMatch(/cancelled/i)

    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: USER_ID },
        data: expect.objectContaining({
          deletionRequested: false,
          deletionCancelledAt: expect.any(Date),
        }),
      })
    )
  })

  it("sends a cancellation confirmation email", async () => {
    ;(prisma.user.update as jest.Mock).mockResolvedValue({
      id: USER_ID,
      email: "user@example.com",
      name: "Alice",
    })

    await cancelPOST(makeCancelRequest())

    expect(sendAccountDeletionCancelledEmail).toHaveBeenCalledWith("user@example.com", "Alice")
  })
})

export {}
