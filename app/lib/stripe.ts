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
  normalizeSecret(process.env.STRIPE_API_KEY) ?? normalizeSecret(process.env.STRIPE_SECRET_KEY)

function getStripe(): Stripe {
  if (!stripeApiKey) {
    throw new Error("Missing STRIPE_API_KEY or STRIPE_SECRET_KEY environment variable")
  }
  return new Stripe(stripeApiKey, {
    apiVersion: "2026-01-28.clover",
    typescript: true,
  })
}

let _stripe: Stripe | undefined

export const stripe = new Proxy({} as Stripe, {
  get(_target, prop, receiver) {
    if (!_stripe) {
      _stripe = getStripe()
    }
    const value = Reflect.get(_stripe, prop, receiver)
    return typeof value === "function" ? value.bind(_stripe) : value
  },
})
