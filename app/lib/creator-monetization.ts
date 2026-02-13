import { type CreatorSubscriptionInterval } from "@prisma/client"

export const CREATOR_TIP_AMOUNTS_CENTS = [500, 1000, 2500, 5000] as const

export const CREATOR_SUBSCRIPTION_PLANS = [
  {
    id: "supporter-monthly",
    tierName: "Supporter",
    amountCents: 900,
    interval: "MONTHLY" as CreatorSubscriptionInterval,
  },
  {
    id: "inner-circle-monthly",
    tierName: "Inner Circle",
    amountCents: 1900,
    interval: "MONTHLY" as CreatorSubscriptionInterval,
  },
  {
    id: "supporter-yearly",
    tierName: "Supporter Annual",
    amountCents: 9000,
    interval: "YEARLY" as CreatorSubscriptionInterval,
  },
] as const

export function isValidTipAmount(amountCents: number): boolean {
  return CREATOR_TIP_AMOUNTS_CENTS.includes(
    amountCents as (typeof CREATOR_TIP_AMOUNTS_CENTS)[number]
  )
}

export function isValidSubscriptionPlan(
  tierName: string,
  amountCents: number,
  interval: CreatorSubscriptionInterval
): boolean {
  return CREATOR_SUBSCRIPTION_PLANS.some(
    (plan) =>
      plan.tierName.toLowerCase() === tierName.toLowerCase() &&
      plan.amountCents === amountCents &&
      plan.interval === interval
  )
}

export function toMonthlyRecurringCents(
  amountCents: number,
  interval: CreatorSubscriptionInterval
): number {
  if (interval === "YEARLY") {
    return Math.round(amountCents / 12)
  }
  return amountCents
}

export function formatCurrencyFromCents(amountCents: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amountCents / 100)
}
