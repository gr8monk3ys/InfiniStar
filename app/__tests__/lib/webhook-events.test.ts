import { pruneProcessedWebhookEvents, WEBHOOK_EVENT_RETENTION_DAYS } from "@/app/lib/webhook-events"

const mockDeleteMany = jest.fn()

jest.mock("@/app/lib/prismadb", () => ({
  __esModule: true,
  default: {
    processedWebhookEvent: {
      deleteMany: (...args: unknown[]) => mockDeleteMany(...args),
    },
  },
}))

/**
 * The Stripe webhook's idempotency ledger is durable, which is the point — the
 * Redis key it replaced evaporated whenever REDIS_URL was unset. Durable also
 * means it never expires on its own, so these tests pin the pruning that
 * replaces the old 48h TTL.
 */
describe("pruneProcessedWebhookEvents", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockDeleteMany.mockResolvedValue({ count: 0 })
  })

  it("deletes only claims older than the retention window", async () => {
    mockDeleteMany.mockResolvedValue({ count: 12 })
    const before = Date.now()

    const result = await pruneProcessedWebhookEvents()

    expect(result.deleted).toBe(12)
    const arg = mockDeleteMany.mock.calls[0][0] as {
      where: { processedAt: { lt: Date } }
    }
    const cutoff = arg.where.processedAt.lt.getTime()
    const expected = before - WEBHOOK_EVENT_RETENTION_DAYS * 24 * 60 * 60 * 1000

    // Within a second of the expected cutoff, allowing for clock drift in test.
    expect(Math.abs(cutoff - expected)).toBeLessThan(1000)
  })

  it("honours a caller-supplied retention window", async () => {
    const before = Date.now()
    await pruneProcessedWebhookEvents(1)

    const arg = mockDeleteMany.mock.calls[0][0] as {
      where: { processedAt: { lt: Date } }
    }
    const cutoff = arg.where.processedAt.lt.getTime()
    expect(Math.abs(cutoff - (before - 24 * 60 * 60 * 1000))).toBeLessThan(1000)
  })

  it("keeps a window far wider than Stripe's 3-day retry period", () => {
    expect(WEBHOOK_EVENT_RETENTION_DAYS).toBeGreaterThan(3)
  })

  it("filters on nothing but age, so a live retry's claim is never removed", async () => {
    await pruneProcessedWebhookEvents()
    const arg = mockDeleteMany.mock.calls[0][0] as { where: Record<string, unknown> }
    expect(Object.keys(arg.where)).toEqual(["processedAt"])
  })

  it("reports zero when there is nothing to prune", async () => {
    await expect(pruneProcessedWebhookEvents()).resolves.toMatchObject({ deleted: 0 })
  })
})
