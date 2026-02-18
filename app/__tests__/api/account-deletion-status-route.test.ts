/**
 * @jest-environment node
 */

/**
 * API Route Tests: Account Deletion Status
 *
 * Tests GET /api/account/deletion-status
 */

import { NextRequest } from "next/server"

import prisma from "@/app/lib/prismadb"
import getCurrentUser from "@/app/actions/getCurrentUser"
// ---- Imports (after mocks) ----

import { GET } from "@/app/api/account/deletion-status/route"

// ---- Mocks ----

jest.mock("@/app/actions/getCurrentUser", () => ({
  __esModule: true,
  default: jest.fn(),
}))

jest.mock("@/app/lib/prismadb", () => ({
  __esModule: true,
  default: {
    user: {
      findUnique: jest.fn(),
    },
  },
}))

// ---- Helpers ----

function createGetRequest(): NextRequest {
  return new NextRequest("http://localhost:3000/api/account/deletion-status", {
    method: "GET",
  })
}

const testUser = { id: "user-1", email: "test@example.com" }

// ---- Tests ----

beforeEach(() => {
  jest.clearAllMocks()
  ;(getCurrentUser as jest.Mock).mockResolvedValue(testUser)
})

describe("GET /api/account/deletion-status", () => {
  describe("Authentication", () => {
    it("returns 401 when getCurrentUser returns null", async () => {
      ;(getCurrentUser as jest.Mock).mockResolvedValue(null)

      const request = createGetRequest()
      const response = await GET(request)

      expect(response.status).toBe(401)
      const data = await response.json()
      expect(data.code).toBe("UNAUTHORIZED")
    })

    it("returns 401 when getCurrentUser returns a user with no id", async () => {
      ;(getCurrentUser as jest.Mock).mockResolvedValue({ email: "test@example.com" })

      const request = createGetRequest()
      const response = await GET(request)

      expect(response.status).toBe(401)
    })
  })

  describe("User not found in database", () => {
    it("returns 404 when prisma cannot find the user record", async () => {
      ;(prisma.user.findUnique as jest.Mock).mockResolvedValue(null)

      const request = createGetRequest()
      const response = await GET(request)

      expect(response.status).toBe(404)
      const data = await response.json()
      expect(data.code).toBe("USER_NOT_FOUND")
    })
  })

  describe("No pending deletion", () => {
    it("returns 200 with deletionRequested false when no deletion is pending", async () => {
      ;(prisma.user.findUnique as jest.Mock).mockResolvedValue({
        deletionRequested: false,
        deletionRequestedAt: null,
        deletionScheduledFor: null,
        deletionCancelledAt: null,
      })

      const request = createGetRequest()
      const response = await GET(request)

      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data.deletionRequested).toBe(false)
      expect(data.deletionRequestedAt).toBeNull()
      expect(data.deletionScheduledFor).toBeNull()
      expect(data.daysRemaining).toBeNull()
    })

    it("returns null daysRemaining when no deletion is scheduled", async () => {
      ;(prisma.user.findUnique as jest.Mock).mockResolvedValue({
        deletionRequested: false,
        deletionRequestedAt: null,
        deletionScheduledFor: null,
        deletionCancelledAt: null,
      })

      const request = createGetRequest()
      const response = await GET(request)

      const data = await response.json()
      expect(data.daysRemaining).toBeNull()
    })
  })

  describe("Pending deletion", () => {
    it("returns 200 with deletionRequested true and scheduled date when deletion is pending", async () => {
      const requestedAt = new Date("2026-02-01T00:00:00.000Z")
      const scheduledFor = new Date("2026-03-03T00:00:00.000Z")

      ;(prisma.user.findUnique as jest.Mock).mockResolvedValue({
        deletionRequested: true,
        deletionRequestedAt: requestedAt,
        deletionScheduledFor: scheduledFor,
        deletionCancelledAt: null,
      })

      const request = createGetRequest()
      const response = await GET(request)

      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data.deletionRequested).toBe(true)
      expect(data.deletionRequestedAt).toBe(requestedAt.toISOString())
      expect(data.deletionScheduledFor).toBe(scheduledFor.toISOString())
    })

    it("calculates positive daysRemaining for a future scheduled deletion", async () => {
      const futureDate = new Date()
      futureDate.setDate(futureDate.getDate() + 10)
      ;(prisma.user.findUnique as jest.Mock).mockResolvedValue({
        deletionRequested: true,
        deletionRequestedAt: new Date(),
        deletionScheduledFor: futureDate,
        deletionCancelledAt: null,
      })

      const request = createGetRequest()
      const response = await GET(request)

      const data = await response.json()
      expect(data.daysRemaining).toBeGreaterThan(0)
      expect(data.daysRemaining).toBeLessThanOrEqual(11)
    })

    it("returns 0 daysRemaining when scheduled deletion is in the past", async () => {
      const pastDate = new Date()
      pastDate.setDate(pastDate.getDate() - 5)
      ;(prisma.user.findUnique as jest.Mock).mockResolvedValue({
        deletionRequested: true,
        deletionRequestedAt: new Date(),
        deletionScheduledFor: pastDate,
        deletionCancelledAt: null,
      })

      const request = createGetRequest()
      const response = await GET(request)

      const data = await response.json()
      expect(data.daysRemaining).toBe(0)
    })

    it("returns null daysRemaining when deletionRequested is false even if scheduledFor is set", async () => {
      const futureDate = new Date()
      futureDate.setDate(futureDate.getDate() + 10)
      ;(prisma.user.findUnique as jest.Mock).mockResolvedValue({
        deletionRequested: false,
        deletionRequestedAt: null,
        deletionScheduledFor: futureDate,
        deletionCancelledAt: null,
      })

      const request = createGetRequest()
      const response = await GET(request)

      const data = await response.json()
      expect(data.daysRemaining).toBeNull()
    })
  })

  describe("Cancelled deletion", () => {
    it("returns 200 with deletionCancelledAt populated when deletion was cancelled", async () => {
      const cancelledAt = new Date("2026-02-10T00:00:00.000Z")

      ;(prisma.user.findUnique as jest.Mock).mockResolvedValue({
        deletionRequested: false,
        deletionRequestedAt: new Date("2026-02-01T00:00:00.000Z"),
        deletionScheduledFor: null,
        deletionCancelledAt: cancelledAt,
      })

      const request = createGetRequest()
      const response = await GET(request)

      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data.deletionCancelledAt).toBe(cancelledAt.toISOString())
    })
  })

  describe("Database query", () => {
    it("queries the database with the current user id", async () => {
      ;(prisma.user.findUnique as jest.Mock).mockResolvedValue({
        deletionRequested: false,
        deletionRequestedAt: null,
        deletionScheduledFor: null,
        deletionCancelledAt: null,
      })

      const request = createGetRequest()
      await GET(request)

      expect(prisma.user.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "user-1" },
        })
      )
    })

    it("selects only the deletion-related fields", async () => {
      ;(prisma.user.findUnique as jest.Mock).mockResolvedValue({
        deletionRequested: false,
        deletionRequestedAt: null,
        deletionScheduledFor: null,
        deletionCancelledAt: null,
      })

      const request = createGetRequest()
      await GET(request)

      expect(prisma.user.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          select: expect.objectContaining({
            deletionRequested: true,
            deletionRequestedAt: true,
            deletionScheduledFor: true,
            deletionCancelledAt: true,
          }),
        })
      )
    })
  })

  describe("Error handling", () => {
    it("returns 500 when the database throws an unexpected error", async () => {
      ;(prisma.user.findUnique as jest.Mock).mockRejectedValue(new Error("DB connection failure"))

      const request = createGetRequest()
      const response = await GET(request)

      expect(response.status).toBe(500)
      const data = await response.json()
      expect(data.code).toBe("INTERNAL_ERROR")
    })
  })
})

export {}
