/**
 * @jest-environment node
 */

/**
 * API Route Tests: AI Usage (GET /api/ai/usage)
 *
 * Focused on the monthly usage aggregate matching the quota gate in
 * app/lib/ai-access.ts: background "summary-auto" usage must be excluded from
 * the displayed token/cost totals, exactly as the gate excludes it.
 */
import { NextRequest } from "next/server"

import { GET } from "@/app/api/ai/usage/route"

const mockGetCurrentUser = jest.fn()
const mockGetUserUsageStats = jest.fn()
const mockGetUsageByDateRange = jest.fn()
const mockGetUserSubscriptionPlan = jest.fn()
const mockCount = jest.fn()
const mockAggregate = jest.fn()
const mockUsageFindMany = jest.fn()
const mockUsageFindFirst = jest.fn()
const mockConversationFindMany = jest.fn()
const mockConversationFindUnique = jest.fn()

jest.mock("@/app/actions/getCurrentUser", () => ({
  __esModule: true,
  default: () => mockGetCurrentUser(),
}))

jest.mock("@/app/lib/ai-usage", () => ({
  getUserUsageStats: (...args: unknown[]) => mockGetUserUsageStats(...args),
  getUsageByDateRange: (...args: unknown[]) => mockGetUsageByDateRange(...args),
}))

jest.mock("@/app/lib/subscription", () => ({
  getUserSubscriptionPlan: (...args: unknown[]) => mockGetUserSubscriptionPlan(...args),
}))

jest.mock("@/app/lib/prismadb", () => ({
  __esModule: true,
  default: {
    aiUsage: {
      count: (...args: unknown[]) => mockCount(...args),
      aggregate: (...args: unknown[]) => mockAggregate(...args),
      findMany: (...args: unknown[]) => mockUsageFindMany(...args),
      findFirst: (...args: unknown[]) => mockUsageFindFirst(...args),
    },
    conversation: {
      findMany: (...args: unknown[]) => mockConversationFindMany(...args),
      findUnique: (...args: unknown[]) => mockConversationFindUnique(...args),
    },
  },
}))

jest.mock("@/app/lib/logger", () => ({
  __esModule: true,
  aiLogger: { warn: jest.fn(), info: jest.fn(), error: jest.fn() },
}))

function createRequest(url = "http://localhost:3000/api/ai/usage"): NextRequest {
  return new NextRequest(url, { method: "GET" })
}

beforeEach(() => {
  jest.clearAllMocks()
  mockGetCurrentUser.mockResolvedValue({ id: "user-1", email: "test@example.com" })
  mockGetUserUsageStats.mockResolvedValue({ usage: [], stats: {} })
  mockGetUsageByDateRange.mockResolvedValue([])
  mockGetUserSubscriptionPlan.mockResolvedValue({ isPro: false, name: "Free" })
  mockCount.mockResolvedValue(3)
  mockAggregate.mockResolvedValue({ _sum: { totalTokens: 1000, totalCost: 50 } })
  mockUsageFindMany.mockResolvedValue([])
  mockUsageFindFirst.mockResolvedValue(null)
  mockConversationFindMany.mockResolvedValue([])
  mockConversationFindUnique.mockResolvedValue(null)
})

describe("GET /api/ai/usage monthly aggregate", () => {
  it("excludes summary-auto from the token/cost aggregate to match the quota gate", async () => {
    const res = await GET(createRequest())
    expect(res.status).toBe(200)

    expect(mockAggregate).toHaveBeenCalledTimes(1)
    expect(mockAggregate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          requestType: { notIn: ["summary-auto"] },
        }),
      })
    )
  })

  it("counts only chat/chat-stream toward the monthly message count", async () => {
    await GET(createRequest())

    expect(mockCount).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          requestType: { in: ["chat", "chat-stream"] },
        }),
      })
    )
  })
})
