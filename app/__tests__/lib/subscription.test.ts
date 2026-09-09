/**
 * @jest-environment node
 */
import { getUserSubscriptionPlan, isProSubscription } from "@/app/lib/subscription"

const mockUserFindFirst = jest.fn()

jest.mock("@/app/lib/prismadb", () => ({
  __esModule: true,
  default: {
    user: {
      findFirst: (...args: unknown[]) => mockUserFindFirst(...args),
    },
  },
}))

describe("isProSubscription", () => {
  it("returns false for a null user", () => {
    expect(isProSubscription(null)).toBe(false)
  })

  it("returns false for an undefined user", () => {
    expect(isProSubscription(undefined)).toBe(false)
  })

  it("returns false when stripePriceId is missing", () => {
    expect(
      isProSubscription({
        stripePriceId: null,
        stripeCurrentPeriodEnd: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30),
      })
    ).toBe(false)
  })

  it("returns false when stripeCurrentPeriodEnd is missing", () => {
    expect(
      isProSubscription({
        stripePriceId: "price_pro",
        stripeCurrentPeriodEnd: null,
      })
    ).toBe(false)
  })

  it("returns true when the current period has not ended yet", () => {
    expect(
      isProSubscription({
        stripePriceId: "price_pro",
        stripeCurrentPeriodEnd: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30),
      })
    ).toBe(true)
  })

  it("returns true within the 24-hour grace period after the period ends", () => {
    expect(
      isProSubscription({
        stripePriceId: "price_pro",
        // Period ended one hour ago, well inside the 24h grace window.
        stripeCurrentPeriodEnd: new Date(Date.now() - 1000 * 60 * 60),
      })
    ).toBe(true)
  })

  it("returns false once the grace period has fully elapsed", () => {
    expect(
      isProSubscription({
        stripePriceId: "price_pro",
        // Period ended 25 hours ago, past the 24h grace window.
        stripeCurrentPeriodEnd: new Date(Date.now() - 1000 * 60 * 60 * 25),
      })
    ).toBe(false)
  })
})

describe("getUserSubscriptionPlan", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("throws when the user does not exist", async () => {
    mockUserFindFirst.mockResolvedValue(null)

    await expect(getUserSubscriptionPlan("missing-user")).rejects.toThrow("User not found")
  })

  it("returns the free plan for a user without an active PRO subscription", async () => {
    mockUserFindFirst.mockResolvedValue({
      stripeSubscriptionId: null,
      stripeCurrentPeriodEnd: null,
      stripeCustomerId: null,
      stripePriceId: null,
    })

    const plan = await getUserSubscriptionPlan("user-1")

    expect(plan.name).toBe("Free")
    expect(plan.isPro).toBe(false)
    expect(plan.stripeCurrentPeriodEnd).toBe(0)
  })

  it("returns the PRO plan for a user with an active subscription", async () => {
    const periodEnd = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30)
    mockUserFindFirst.mockResolvedValue({
      stripeSubscriptionId: "sub_123",
      stripeCurrentPeriodEnd: periodEnd,
      stripeCustomerId: "cus_123",
      stripePriceId: "price_pro",
    })

    const plan = await getUserSubscriptionPlan("user-1")

    expect(plan.name).toBe("PRO")
    expect(plan.isPro).toBe(true)
    expect(plan.stripeSubscriptionId).toBe("sub_123")
    expect(plan.stripeCustomerId).toBe("cus_123")
    expect(plan.stripeCurrentPeriodEnd).toBe(periodEnd.getTime())
  })

  it("still resolves to a PRO plan within the grace period after expiry", async () => {
    mockUserFindFirst.mockResolvedValue({
      stripeSubscriptionId: "sub_123",
      stripeCurrentPeriodEnd: new Date(Date.now() - 1000 * 60 * 60),
      stripeCustomerId: "cus_123",
      stripePriceId: "price_pro",
    })

    const plan = await getUserSubscriptionPlan("user-1")

    expect(plan.isPro).toBe(true)
  })

  it("reads on a passed-in transaction client instead of the default one", async () => {
    const txUserFindFirst = jest.fn().mockResolvedValue({
      stripeSubscriptionId: null,
      stripeCurrentPeriodEnd: null,
      stripeCustomerId: null,
      stripePriceId: null,
    })
    const txClient = {
      user: { findFirst: txUserFindFirst },
    } as unknown as Parameters<typeof getUserSubscriptionPlan>[1]

    await getUserSubscriptionPlan("user-1", txClient)

    expect(txUserFindFirst).toHaveBeenCalledTimes(1)
    expect(mockUserFindFirst).not.toHaveBeenCalled()
  })
})
