import Stripe from "stripe"

function normalizeSecret(value: string | undefined): string | undefined {
  if (!value) {
    return undefined
  }

  const trimmed = value.trim()
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1)
  }

  return trimmed
}

const stripeApiKey =
  normalizeSecret(process.env.STRIPE_API_KEY) ??
  normalizeSecret(process.env.STRIPE_SECRET_KEY) ??
  "sk_test_placeholder"

export const stripe = new Stripe(stripeApiKey, {
  apiVersion: "2026-01-28.clover",
  typescript: true,
})
