import { freePlan, proPlan } from "@/config/subscriptions"
import prisma from "@/app/lib/prismadb"
import { type UserSubscriptionPlan } from "@/app/types"

/** 24-hour buffer so users aren't cut off while Stripe processes renewal payments. */
const PRO_GRACE_PERIOD_MS = 24 * 60 * 60 * 1000

/** The Stripe columns the PRO predicate reads. */
export interface ProSubscriptionFields {
  stripePriceId?: string | null
  stripeCurrentPeriodEnd?: Date | null
}

/**
 * Whether these Stripe columns describe an active PRO subscription.
 *
 * The one place the grace period is applied. Two callers that already held the
 * user row re-derived this inline and spelled the buffer as a bare
 * `86_400_000`, which is three copies of one predicate and two chances for the
 * grace period to be changed in one place and not the others. They take this
 * instead of a database round-trip they do not need.
 */
export function isProSubscription(user: ProSubscriptionFields | null | undefined): boolean {
  return Boolean(
    user?.stripePriceId &&
    user.stripeCurrentPeriodEnd &&
    user.stripeCurrentPeriodEnd.getTime() + PRO_GRACE_PERIOD_MS > Date.now()
  )
}

export async function getUserSubscriptionPlan(userId: string): Promise<UserSubscriptionPlan> {
  const user = await prisma.user.findFirst({
    where: {
      id: userId,
    },
    select: {
      stripeSubscriptionId: true,
      stripeCurrentPeriodEnd: true,
      stripeCustomerId: true,
      stripePriceId: true,
    },
  })

  if (!user) {
    throw new Error("User not found")
  }

  const isPro = isProSubscription(user)

  const plan = isPro ? proPlan : freePlan

  return {
    ...plan,
    stripeCustomerId: user.stripeCustomerId,
    stripeSubscriptionId: user.stripeSubscriptionId,
    stripePriceId: plan.stripePriceId,
    stripeCurrentPeriodEnd: user.stripeCurrentPeriodEnd?.getTime() ?? 0,
    isPro,
  }
}
