import { env } from "@/env.mjs"

import { type SubscriptionPlan } from "@/app/types"

export const freePlan: SubscriptionPlan = {
  name: "Free",
  description: "Get started with AI conversations. Perfect for trying out InfiniStar's features.",
  stripePriceId: "",
  price: 0,
  features: [
    "10 AI messages per month",
    "All 7 AI personalities",
    "Claude 3.5 Sonnet model",
    "Message history",
    "Basic search",
    "50 AI memories",
  ],
}

export const proPlan: SubscriptionPlan = {
  name: "PRO",
  description: "Unlimited AI conversations with premium features for power users.",
  stripePriceId: env.STRIPE_PRO_MONTHLY_PLAN_ID || "",
  price: 20,
  features: [
    "Unlimited AI messages",
    "All 7 AI personalities",
    "All Claude models (Sonnet, Haiku, Opus)",
    "Priority response times",
    "Advanced search & analytics",
    "200 AI memories",
    "Conversation export (MD, JSON, TXT)",
    "Conversation sharing",
    "Auto-delete settings",
    "Priority support",
  ],
}
