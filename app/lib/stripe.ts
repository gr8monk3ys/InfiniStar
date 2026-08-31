/**
 * Stripe client.
 *
 * The lazily-constructed singleton from `@gr8monk3ys/next-kit/stripe`: property
 * access builds it on first use, so importing this module never touches the
 * secret and `next build` does not need one. The key is read from
 * STRIPE_API_KEY (this app's variable) or STRIPE_SECRET_KEY, with wrapping
 * quotes stripped.
 */
export {
  stripe,
  getStripe,
  isStripeConfigured,
  constructWebhookEvent,
  createCheckoutSession,
  createBillingPortalSession,
} from "@gr8monk3ys/next-kit/stripe"
