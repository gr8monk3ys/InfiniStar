/**
 * @jest-environment node
 */
import {
  claimAllowanceSlot,
  getAiAccessDecision,
  monthlySnapshot,
  PENDING_CLAIM_MODEL,
  releaseAllowanceClaim,
  requestAiAccess,
} from "@/app/lib/ai-access"
import prisma from "@/app/lib/prismadb"
import { getUserSubscriptionPlan } from "@/app/lib/subscription"

const captureMock = jest.fn()
jest.mock("@/app/lib/analytics", () => ({
  __esModule: true,
  captureServerEvent: (...args: unknown[]) => captureMock(...args),
}))

const mockUsageCreate = jest.fn()
// Spies belonging to the transaction client only. If the claim reads on the
// global client instead, these stay untouched and the test below fails.
const mockTxCount = jest.fn()
const mockTxAggregate = jest.fn()
const mockTxUserFindFirst = jest.fn()
const mockUsageDelete = jest.fn()
const mockExecuteRaw = jest.fn()

jest.mock("@/app/lib/prismadb", () => ({
  __esModule: true,
  default: {
    aiUsage: {
      count: jest.fn(),
      aggregate: jest.fn(),
      create: (...a: unknown[]) => mockUsageCreate(...a),
      delete: (...a: unknown[]) => mockUsageDelete(...a),
    },
    $executeRaw: (...a: unknown[]) => mockExecuteRaw(...a),
    // The transaction runs its callback against a client exposing the same
    // surface, which is what the claim uses.
    $transaction: (fn: (tx: unknown) => unknown) =>
      fn({
        aiUsage: {
          create: (...a: unknown[]) => mockUsageCreate(...a),
          count: (...a: unknown[]) => mockTxCount(...a),
          aggregate: (...a: unknown[]) => mockTxAggregate(...a),
        },
        user: { findFirst: (...a: unknown[]) => mockTxUserFindFirst(...a) },
        $executeRaw: (...a: unknown[]) => mockExecuteRaw(...a),
      }),
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

// ---------------------------------------------------------------------------
// The month is counted once
// ---------------------------------------------------------------------------

describe("monthlySnapshot", () => {
  beforeEach(() => {
    ;(prisma.aiUsage.count as jest.Mock).mockResolvedValue(3)
    ;(prisma.aiUsage.aggregate as jest.Mock).mockResolvedValue({
      _sum: { totalTokens: 1000, totalCost: 250 },
    })
  })

  /**
   * The defect. `/api/ai/usage` ran its own copy of these aggregates, without
   * this filter, so the number the dashboard displayed was strictly larger than
   * the number actually gating the chatter — and `auto-summary.ts` writes a
   * `summary-auto` row per conversation, so the gap grew with use.
   */
  it("excludes system-initiated generation from the totals a chatter is judged on", async () => {
    await monthlySnapshot(USER_ID)

    const aggregateArgs = (prisma.aiUsage.aggregate as jest.Mock).mock.calls[0][0]
    expect(aggregateArgs.where.requestType).toEqual({ notIn: ["summary-auto"] })
  })

  it("counts only the chatter's own messages toward the message allowance", async () => {
    await monthlySnapshot(USER_ID)

    const countArgs = (prisma.aiUsage.count as jest.Mock).mock.calls[0][0]
    expect(countArgs.where.requestType).toEqual({ in: ["chat", "chat-stream"] })
  })

  it("starts the window at the first of the month, UTC", async () => {
    const { monthStart } = await monthlySnapshot(USER_ID)

    expect(monthStart.getUTCDate()).toBe(1)
    expect(monthStart.getUTCHours()).toBe(0)
    expect(monthStart.getUTCMinutes()).toBe(0)
  })

  it("is the same query the enforced decision runs", async () => {
    ;(getUserSubscriptionPlan as jest.Mock).mockResolvedValue({ isPro: false })
    ;(prisma.aiUsage.aggregate as jest.Mock).mockClear()

    await getAiAccessDecision(USER_ID)
    const enforced = (prisma.aiUsage.aggregate as jest.Mock).mock.calls[0][0]

    ;(prisma.aiUsage.aggregate as jest.Mock).mockClear()
    await monthlySnapshot(USER_ID)
    const displayed = (prisma.aiUsage.aggregate as jest.Mock).mock.calls[0][0]

    expect(enforced.where.requestType).toEqual(displayed.where.requestType)
    expect(enforced._sum).toEqual(displayed._sum)
  })
})

// ---------------------------------------------------------------------------
// The grant
// ---------------------------------------------------------------------------

describe("requestAiAccess", () => {
  beforeEach(() => {
    ;(prisma.aiUsage.count as jest.Mock).mockResolvedValue(0)
    ;(prisma.aiUsage.aggregate as jest.Mock).mockResolvedValue({
      _sum: { totalTokens: 0, totalCost: 0 },
    })
  })

  it("carries the tier as a field rather than inside the usage-display payload", async () => {
    ;(getUserSubscriptionPlan as jest.Mock).mockResolvedValue({ isPro: true })

    const grant = await requestAiAccess({ userId: USER_ID, requestType: "chat" })

    expect(grant.ok).toBe(true)
    if (grant.ok) expect(grant.isPro).toBe(true)
  })

  it("answers a denial with the 402 the eight routes used to spell themselves", async () => {
    ;(getUserSubscriptionPlan as jest.Mock).mockResolvedValue({ isPro: false })
    ;(prisma.aiUsage.count as jest.Mock).mockResolvedValue(9999)

    const grant = await requestAiAccess({ userId: USER_ID, requestType: "chat" })

    expect(grant.ok).toBe(false)
    if (!grant.ok) {
      expect(grant.response.status).toBe(402)
      const body = await grant.response.json()
      expect(body.code).toBe("FREE_TIER_MESSAGE_LIMIT_REACHED")
      expect(body.error).toEqual(expect.any(String))
      expect(body.limits).toBeDefined()
    }
  })

  /**
   * `image/generate` and `transcribe` pulled the cap and the usage back out of
   * `limits` and re-ran this themselves. A single expensive request must not be
   * able to step over the cap.
   */
  it("applies the PRO cost cap to usage plus this request's estimate", async () => {
    ;(getUserSubscriptionPlan as jest.Mock).mockResolvedValue({ isPro: true })
    ;(prisma.aiUsage.aggregate as jest.Mock).mockResolvedValue({
      _sum: { totalTokens: 0, totalCost: 999_999 },
    })

    const grant = await requestAiAccess({
      userId: USER_ID,
      requestType: "image-generate",
      estimatedCostCents: 100,
    })

    expect(grant.ok).toBe(false)
    if (!grant.ok) {
      const body = await grant.response.json()
      expect(body.code).toBe("PRO_TIER_COST_CAP_REACHED")
    }
  })

  /**
   * The cost cap is a PRO fair-use bound; a free chatter is held by the message
   * and token limits instead. (Image generation is not the example to use here
   * — `AI_FREE_MONTHLY_IMAGE_LIMIT` defaults to 0, so a free chatter is denied
   * that feature outright, before any cost is considered.)
   */
  it("does not apply the cost cap to a free-tier chatter", async () => {
    ;(getUserSubscriptionPlan as jest.Mock).mockResolvedValue({ isPro: false })

    const grant = await requestAiAccess({
      userId: USER_ID,
      requestType: "chat",
      estimatedCostCents: 999_999,
    })

    expect(grant.ok).toBe(true)
  })

  /**
   * `limits` is optional on the decision, and model routing used to read
   * `limits?.isPro ?? false` out of it — so a decision that allowed without
   * limits served a PRO chatter the free-tier model silently. Denying is the
   * fail-safe answer.
   */
  it("denies rather than serving a grant it cannot describe", async () => {
    ;(getUserSubscriptionPlan as jest.Mock).mockRejectedValue(new Error("stripe is down"))

    const grant = await requestAiAccess({ userId: USER_ID, requestType: "chat" })

    expect(grant.ok).toBe(false)
    if (!grant.ok) {
      const body = await grant.response.json()
      expect(body.code).toBe("AI_ACCESS_CHECK_FAILED")
    }
  })
})

// ---------------------------------------------------------------------------
// The Claim
// ---------------------------------------------------------------------------

describe("claimAllowanceSlot", () => {
  beforeEach(() => {
    mockUsageCreate.mockReset().mockResolvedValue({ id: "claim-1" })
    mockUsageDelete.mockReset().mockResolvedValue({})
    mockExecuteRaw.mockReset().mockResolvedValue(1)
    // The claim reads on the transaction client, so these are the spies that
    // drive it. The global ones stay untouched, which is itself asserted below.
    mockTxCount.mockReset().mockResolvedValue(0)
    mockTxAggregate.mockReset().mockResolvedValue({ _sum: { totalTokens: 0, totalCost: 0 } })
    mockTxUserFindFirst.mockReset().mockResolvedValue({
      stripePriceId: null,
      stripeCurrentPeriodEnd: null,
      stripeCustomerId: null,
      stripeSubscriptionId: null,
    })
    ;(prisma.aiUsage.count as jest.Mock).mockClear().mockResolvedValue(0)
    ;(prisma.aiUsage.aggregate as jest.Mock).mockClear().mockResolvedValue({
      _sum: { totalTokens: 0, totalCost: 0 },
    })
    ;(getUserSubscriptionPlan as jest.Mock).mockResolvedValue({ isPro: false })
  })

  /**
   * Every read in the claim must happen on the transaction client.
   *
   * Reading on the global client instead holds a second pool connection for the
   * life of the transaction, and `pg` defaults to a pool of ten — roughly six
   * concurrent turns would deadlock, each transaction waiting for a connection
   * that none of them will release until they get one. That is a load-dependent
   * outage, so it is pinned rather than left to review.
   */
  it("does every read on the transaction client, never a second connection", async () => {
    mockTxCount.mockResolvedValue(0)
    mockTxAggregate.mockResolvedValue({ _sum: { totalTokens: 0, totalCost: 0 } })
    mockTxUserFindFirst.mockResolvedValue({
      stripePriceId: null,
      stripeCurrentPeriodEnd: null,
      stripeCustomerId: null,
      stripeSubscriptionId: null,
    })
    ;(prisma.aiUsage.count as jest.Mock).mockClear()
    ;(prisma.aiUsage.aggregate as jest.Mock).mockClear()

    const grant = await claimAllowanceSlot({ userId: USER_ID, conversationId: "conv-1" })

    expect(grant.ok).toBe(true)
    expect(mockTxCount).toHaveBeenCalled()
    expect(mockTxAggregate).toHaveBeenCalled()
    expect(prisma.aiUsage.count).not.toHaveBeenCalled()
    expect(prisma.aiUsage.aggregate).not.toHaveBeenCalled()
  })

  /**
   * The gap this closes. `getAiAccessDecision` counted and `trackAiUsage` wrote,
   * and nothing reserved anything in between — so two turns at 49 of 50 both
   * counted 49 and both proceeded. The advisory lock is what makes the second
   * turn wait for the first one's row.
   */
  it("takes a per-chatter advisory lock before counting", async () => {
    await claimAllowanceSlot({ userId: USER_ID, conversationId: "conv-1" })

    expect(mockExecuteRaw).toHaveBeenCalled()
    const sql = mockExecuteRaw.mock.calls[0][0]
    expect(sql.join("?")).toContain("pg_advisory_xact_lock")
  })

  it("writes the claim before the provider is called, so a concurrent turn counts it", async () => {
    const grant = await claimAllowanceSlot({ userId: USER_ID, conversationId: "conv-1" })

    expect(grant.ok).toBe(true)
    if (grant.ok) expect(grant.claim).toEqual({ id: "claim-1" })

    const row = mockUsageCreate.mock.calls[0][0].data
    expect(row).toMatchObject({
      userId: USER_ID,
      conversationId: "conv-1",
      totalTokens: 0,
      totalCost: 0,
      requestType: "chat",
      model: PENDING_CLAIM_MODEL,
    })
  })

  it("writes no claim when the Allowance is exhausted", async () => {
    mockTxCount.mockResolvedValue(9999)

    const grant = await claimAllowanceSlot({ userId: USER_ID, conversationId: "conv-1" })

    expect(grant.ok).toBe(false)
    expect(mockUsageCreate).not.toHaveBeenCalled()
  })

  /**
   * Failing to take the Claim is failing to verify the Allowance, and the
   * fail-safe answer to that is the same as any other: deny.
   */
  it("denies rather than proceeding unclaimed when the claim cannot be written", async () => {
    mockUsageCreate.mockRejectedValue(new Error("deadlock detected"))

    const grant = await claimAllowanceSlot({ userId: USER_ID, conversationId: "conv-1" })

    expect(grant.ok).toBe(false)
    if (!grant.ok) {
      const body = await grant.response.json()
      expect(body.code).toBe("AI_ACCESS_CHECK_FAILED")
    }
  })

  it("records the claim under the request type the decision was made under", async () => {
    await claimAllowanceSlot({
      userId: USER_ID,
      conversationId: "conv-1",
      requestType: "chat-stream",
    })

    expect(mockUsageCreate.mock.calls[0][0].data.requestType).toBe("chat-stream")
  })
})

describe("releaseAllowanceClaim", () => {
  beforeEach(() => {
    mockUsageDelete.mockReset().mockResolvedValue({})
  })

  it("gives the slot back", async () => {
    await releaseAllowanceClaim({ id: "claim-1" })

    expect(mockUsageDelete).toHaveBeenCalledWith({ where: { id: "claim-1" } })
  })

  /**
   * A Claim that outlives its turn costs the chatter one message. Throwing here
   * would turn that into a failed request on top, so it is swallowed — the safe
   * direction to fail in.
   */
  it("does not throw when the release itself fails", async () => {
    mockUsageDelete.mockRejectedValue(new Error("connection lost"))

    await expect(releaseAllowanceClaim({ id: "claim-1" })).resolves.toBeUndefined()
  })
})
