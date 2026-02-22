/**
 * @jest-environment node
 */

/**
 * API Route Tests: Cron Process Deletions
 *
 * Tests GET /api/cron/process-deletions
 */

import { NextRequest } from "next/server"

import { getDeletionStats, processScheduledDeletions } from "@/app/lib/account-deletion"
import { GET } from "@/app/api/cron/process-deletions/route"

// ---- Mocks ----

jest.mock("@/app/lib/account-deletion", () => ({
  processScheduledDeletions: jest.fn(),
  getDeletionStats: jest.fn(),
}))

// ---- Helpers ----

const CRON_SECRET = "super-secret-cron-token"
const originalEnv = process.env

function makeCronRequest(authHeader?: string): NextRequest {
  return new NextRequest("http://localhost:3000/api/cron/process-deletions", {
    method: "GET",
    headers: authHeader ? { authorization: authHeader } : {},
  })
}

const defaultStatsBefore = {
  pendingDeletions: 2,
  overdueForDeletion: 1,
  cancelledDeletions: 0,
}

const defaultStatsAfter = {
  pendingDeletions: 1,
  overdueForDeletion: 0,
  cancelledDeletions: 0,
}

// ---- Tests ----

beforeEach(() => {
  jest.clearAllMocks()

  process.env = {
    ...originalEnv,
    CRON_SECRET,
  }
  ;(getDeletionStats as jest.Mock)
    .mockResolvedValueOnce(defaultStatsBefore)
    .mockResolvedValueOnce(defaultStatsAfter)
  ;(processScheduledDeletions as jest.Mock).mockResolvedValue({
    processed: 1,
    failed: 0,
    errors: [],
  })
})

afterAll(() => {
  process.env = originalEnv
})

describe("GET /api/cron/process-deletions", () => {
  it("returns 401 when Authorization header is missing", async () => {
    const response = await GET(makeCronRequest())
    expect(response.status).toBe(401)
    const data = await response.json()
    expect(data.error).toMatch(/unauthorized/i)
  })

  it("returns 401 when Authorization header has wrong secret", async () => {
    const response = await GET(makeCronRequest("Bearer wrong-secret"))
    expect(response.status).toBe(401)
  })

  it("returns 401 when CRON_SECRET env var is not set", async () => {
    delete process.env.CRON_SECRET

    const response = await GET(makeCronRequest(`Bearer ${CRON_SECRET}`))
    expect(response.status).toBe(401)
  })

  it("returns 401 when Authorization is not Bearer type", async () => {
    const response = await GET(makeCronRequest(`Basic ${CRON_SECRET}`))
    expect(response.status).toBe(401)
  })

  it("processes scheduled deletions and returns count", async () => {
    ;(processScheduledDeletions as jest.Mock).mockResolvedValue({
      processed: 3,
      failed: 0,
      errors: [],
    })
    ;(getDeletionStats as jest.Mock)
      .mockResolvedValueOnce({ pendingDeletions: 5, overdueForDeletion: 3, cancelledDeletions: 1 })
      .mockResolvedValueOnce({ pendingDeletions: 2, overdueForDeletion: 0, cancelledDeletions: 1 })

    const response = await GET(makeCronRequest(`Bearer ${CRON_SECRET}`))
    expect(response.status).toBe(200)

    const data = await response.json()
    expect(data.success).toBe(true)
    expect(data.processed).toBe(3)
    expect(data.failed).toBe(0)
  })

  it("returns stats both before and after processing", async () => {
    const response = await GET(makeCronRequest(`Bearer ${CRON_SECRET}`))
    expect(response.status).toBe(200)

    const data = await response.json()
    expect(data.stats.before).toEqual(defaultStatsBefore)
    expect(data.stats.after).toEqual(defaultStatsAfter)
  })

  it("handles empty deletion queue gracefully (0 processed)", async () => {
    ;(processScheduledDeletions as jest.Mock).mockResolvedValue({
      processed: 0,
      failed: 0,
      errors: [],
    })
    ;(getDeletionStats as jest.Mock)
      .mockResolvedValueOnce({ pendingDeletions: 0, overdueForDeletion: 0, cancelledDeletions: 0 })
      .mockResolvedValueOnce({ pendingDeletions: 0, overdueForDeletion: 0, cancelledDeletions: 0 })

    const response = await GET(makeCronRequest(`Bearer ${CRON_SECRET}`))
    expect(response.status).toBe(200)

    const data = await response.json()
    expect(data.processed).toBe(0)
    expect(data.failed).toBe(0)
    expect(data.errors).toBeUndefined() // Empty errors array is not included
  })

  it("handles per-user errors without stopping the whole batch", async () => {
    ;(processScheduledDeletions as jest.Mock).mockResolvedValue({
      processed: 2,
      failed: 1,
      errors: ["Failed to delete user user-bad-id: Database connection timeout"],
    })
    ;(getDeletionStats as jest.Mock)
      .mockResolvedValueOnce({ pendingDeletions: 3, overdueForDeletion: 3, cancelledDeletions: 0 })
      .mockResolvedValueOnce({ pendingDeletions: 0, overdueForDeletion: 1, cancelledDeletions: 0 })

    const response = await GET(makeCronRequest(`Bearer ${CRON_SECRET}`))
    expect(response.status).toBe(200) // Batch continues despite one failure

    const data = await response.json()
    expect(data.processed).toBe(2)
    expect(data.failed).toBe(1)
    expect(data.errors).toHaveLength(1)
    expect(data.errors[0]).toContain("Failed to delete user")
  })

  it("returns 500 when processScheduledDeletions throws unexpectedly", async () => {
    ;(processScheduledDeletions as jest.Mock).mockRejectedValue(
      new Error("Database connection failed")
    )

    const response = await GET(makeCronRequest(`Bearer ${CRON_SECRET}`))
    expect(response.status).toBe(500)
    const data = await response.json()
    expect(data.error).toMatch(/internal server error/i)
  })

  it("calls getDeletionStats twice (before and after processing)", async () => {
    await GET(makeCronRequest(`Bearer ${CRON_SECRET}`))

    expect(getDeletionStats).toHaveBeenCalledTimes(2)
    expect(processScheduledDeletions).toHaveBeenCalledTimes(1)
  })

  it("does not include errors field in response when there are no errors", async () => {
    ;(processScheduledDeletions as jest.Mock).mockResolvedValue({
      processed: 1,
      failed: 0,
      errors: [],
    })

    const response = await GET(makeCronRequest(`Bearer ${CRON_SECRET}`))
    const data = await response.json()

    // Route only includes errors when array is non-empty
    expect(data.errors).toBeUndefined()
  })
})

export {}
