import { env } from "@/env.mjs"

import { type SubscriptionPlan } from "@/app/types"

export const freePlan: SubscriptionPlan = {
  name: "Free",
  description: "Get started with AI conversations. Perfect for trying out InfiniStar's features.",
  stripePriceId: "",
  price: 0,
  features: [
    "50 AI messages per month",
    "All 7 AI personalities",
    "Claude Haiku 4.5 model",
    "Message history",
    "Basic search",
    "50 AI memories",
  ],
}

export const proPlan: SubscriptionPlan = {
  name: "PRO",
  description: "Higher limits and better models for power users.",
  stripePriceId: env.STRIPE_PRO_MONTHLY_PLAN_ID || "",
  price: 9.99,
  features: [
    "High monthly limits (fair use cap applies)",
    "All 7 AI personalities",
    "Claude Sonnet 4.5 + Haiku 4.5",
    "Faster response tier",
    "Advanced search & analytics",
    "200 AI memories",
    "Conversation export (MD, JSON, TXT)",
    "Conversation sharing",
    "Auto-delete settings",
    "Priority support",
  ],
}
