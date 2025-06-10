/**
 * @jest-environment node
 */
import { getAiAccessDecision } from "@/app/lib/ai-access"
import prisma from "@/app/lib/prismadb"
import { getUserSubscriptionPlan } from "@/app/lib/subscription"

const captureMock = jest.fn()
jest.mock("@/app/lib/analytics", () => ({
  __esModule: true,
  captureServerEvent: (...args: unknown[]) => captureMock(...args),
}))

jest.mock("@/app/lib/prismadb", () => ({
  __esModule: true,
  default: {
    aiUsage: {
      count: jest.fn(),
      aggregate: jest.fn(),
    },
  },
}))

jest.mock("@/app/lib/subscription", () => ({
  __esModule: true,
  getUserSubscriptionPlan: jest.fn(),
}))

const USER_ID = "11111111-1111-4111-8111-111111111111"

describe("getAiAccessDecision analytics", () => {
  beforeEach(() => {
    captureMock.mockClear()
    ;(getUserSubscriptionPlan as jest.Mock).mockResolvedValue({ isPro: false })
    ;(prisma.aiUsage.aggregate as jest.Mock).mockResolvedValue({
      _sum: { totalTokens: 0, totalCost: 0 },
    })
  })

  it("fires ai_limit_reached with the denial code when the free message limit is hit", async () => {
    ;(prisma.aiUsage.count as jest.Mock).mockResolvedValue(9999)

    const decision = await getAiAccessDecision(USER_ID)

    expect(decision.allowed).toBe(false)
    expect(decision.code).toBe("FREE_TIER_MESSAGE_LIMIT_REACHED")
    expect(captureMock).toHaveBeenCalledWith(
      USER_ID,
      "ai_limit_reached",
      expect.objectContaining({ code: "FREE_TIER_MESSAGE_LIMIT_REACHED" })
    )
  })

  it("does not fire ai_limit_reached when access is allowed", async () => {
    ;(prisma.aiUsage.count as jest.Mock).mockResolvedValue(0)

    const decision = await getAiAccessDecision(USER_ID)

    expect(decision.allowed).toBe(true)
    expect(captureMock).not.toHaveBeenCalled()
  })
})
