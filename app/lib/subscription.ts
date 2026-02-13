import { freePlan, proPlan } from "@/config/subscriptions"
import { db } from "@/app/lib/prismadb"
import { type UserSubscriptionPlan } from "@/app/types"

export async function getUserSubscriptionPlan(userId: string): Promise<UserSubscriptionPlan> {
  const user = await db.user.findFirst({
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
    user.stripeCurrentPeriodEnd.getTime() + 86_400_000 > Date.now()
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
