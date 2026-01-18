import { env } from "@/env.mjs"

import { type SubscriptionPlan } from "@/app/types"

export const freePlan: SubscriptionPlan = {
  name: "Free",
  description: "The free plan is limited to 3 posts. Upgrade to the PRO plan for unlimited posts.",
  stripePriceId: "",
  price: 0,
  features: ["3 posts", "Basic support"],
}

export const proPlan: SubscriptionPlan = {
  name: "PRO",
  description: "The PRO plan has unlimited chats.",
  stripePriceId: env.STRIPE_PRO_MONTHLY_PLAN_ID || "",
  price: 20,
  features: ["Unlimited chats", "Priority support"],
}
