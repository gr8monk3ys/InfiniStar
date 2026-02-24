import { freePlan, proPlan } from "@/config/subscriptions"
import prisma from "@/app/lib/prismadb"
import { type UserSubscriptionPlan } from "@/app/types"

/** 24-hour buffer so users aren't cut off while Stripe processes renewal payments. */
const PRO_GRACE_PERIOD_MS = 24 * 60 * 60 * 1000

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

  // Check if user is on a pro plan.
  const isPro = Boolean(
    user.stripePriceId &&
    user.stripeCurrentPeriodEnd &&
    user.stripeCurrentPeriodEnd.getTime() + PRO_GRACE_PERIOD_MS > Date.now()
  )

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
