import { headers } from "next/headers"
import { NextResponse } from "next/server"
import type Stripe from "stripe"

import { captureServerEvent } from "@/app/lib/analytics"
import { sendPaymentFailedEmail } from "@/app/lib/email"
import { stripeLogger } from "@/app/lib/logger"
import prisma from "@/app/lib/prismadb"
import { stripe } from "@/app/lib/stripe"

function getCurrentPeriodEnd(subscription: Stripe.Subscription): Date | null {
  const periodEnd = subscription.items.data[0]?.current_period_end
  return periodEnd ? new Date(periodEnd * 1000) : null
}

function getCustomerId(
  customer: string | Stripe.Customer | Stripe.DeletedCustomer | null
): string | null {
  if (!customer) {
    return null
  }
  return typeof customer === "string" ? customer : customer.id
}

function getInvoiceSubscriptionId(invoice: Stripe.Invoice): string | null {
  const subscriptionRef = invoice.parent?.subscription_details?.subscription
  if (!subscriptionRef) {
    return null
  }
  return typeof subscriptionRef === "string" ? subscriptionRef : subscriptionRef.id
}

function isPlatformProSubscription(subscription: Stripe.Subscription): boolean {
  const configuredPriceId = process.env.STRIPE_PRO_MONTHLY_PLAN_ID
  const subscriptionPriceId = subscription.items.data[0]?.price?.id
  return Boolean(
    configuredPriceId && subscriptionPriceId && configuredPriceId === subscriptionPriceId
  )
}

function mapCreatorSubscriptionStatus(
  status: Stripe.Subscription.Status
): "ACTIVE" | "PAUSED" | "CANCELED" {
  switch (status) {
    case "active":
    case "trialing":
      return "ACTIVE"
    case "past_due":
    case "unpaid":
    case "incomplete":
      return "PAUSED"
    default:
      return "CANCELED"
  }
}

async function handleCreatorTipCheckoutCompleted(session: Stripe.Checkout.Session): Promise<void> {
  const supporterId = session.metadata?.supporterId
  const creatorId = session.metadata?.creatorId
  const rawAmountCents = session.metadata?.amountCents
  const amountCents = Number.parseInt(rawAmountCents || "", 10)

  if (!supporterId || !creatorId || !Number.isFinite(amountCents) || amountCents <= 0) {
    stripeLogger.error(
      {
        checkoutSessionId: session.id,
        supporterId,
        creatorId,
        rawAmountCents,
      },
      "Creator tip checkout session missing required metadata"
    )
    return
  }

  const paymentIntentId =
    typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id
  const note = session.metadata?.note?.trim() || null
  const currency = (session.currency || "usd").toUpperCase()
  const status = session.payment_status === "paid" ? "COMPLETED" : "PENDING"

  await prisma.creatorTip.upsert({
    where: { stripeCheckoutSessionId: session.id },
    update: {
      amountCents,
      note,
      currency,
      status,
      stripePaymentIntentId: paymentIntentId ?? null,
    },
    create: {
      supporterId,
      creatorId,
      amountCents,
      note,
      currency,
      status,
      stripeCheckoutSessionId: session.id,
      stripePaymentIntentId: paymentIntentId ?? null,
    },
  })
}

async function handleCreatorSubscriptionCheckoutCompleted(
  session: Stripe.Checkout.Session
): Promise<void> {
  const supporterId = session.metadata?.supporterId
  const creatorId = session.metadata?.creatorId
  const subscriptionId =
    typeof session.subscription === "string" ? session.subscription : session.subscription?.id
  const rawAmountCents = session.metadata?.amountCents
  const amountCents = Number.parseInt(rawAmountCents || "", 10)
  const tierName = session.metadata?.tierName?.trim() || "Supporter"
  const interval = session.metadata?.interval === "YEARLY" ? "YEARLY" : "MONTHLY"
  const customerId = getCustomerId(session.customer)

  if (
    !supporterId ||
    !creatorId ||
    !subscriptionId ||
    !Number.isFinite(amountCents) ||
    amountCents <= 0
  ) {
    stripeLogger.error(
      {
        checkoutSessionId: session.id,
        supporterId,
        creatorId,
        subscriptionId,
        rawAmountCents,
      },
      "Creator subscription checkout session missing required metadata"
    )
    return
  }

  const subscription = await stripe.subscriptions.retrieve(subscriptionId)
  if ("deleted" in subscription && subscription.deleted) {
    return
  }

  const activeSubscription = subscription as Stripe.Subscription
  const currentPeriodEnd = getCurrentPeriodEnd(activeSubscription)

  await prisma.creatorSubscription.upsert({
    where: {
      supporterId_creatorId: {
        supporterId,
        creatorId,
      },
    },
    update: {
      tierName,
      amountCents,
      interval,
      currency: (session.currency || "usd").toUpperCase(),
      status: "ACTIVE",
      canceledAt: null,
      startedAt: new Date(),
      stripeSubscriptionId: activeSubscription.id,
      stripeCheckoutSessionId: session.id,
      stripeCustomerId: customerId,
      stripeCurrentPeriodEnd: currentPeriodEnd,
    },
    create: {
      supporterId,
      creatorId,
      tierName,
      amountCents,
      interval,
      currency: (session.currency || "usd").toUpperCase(),
      status: "ACTIVE",
      stripeSubscriptionId: activeSubscription.id,
      stripeCheckoutSessionId: session.id,
      stripeCustomerId: customerId,
      stripeCurrentPeriodEnd: currentPeriodEnd,
    },
  })
}

async function syncCreatorSubscriptionFromStripe(subscription: Stripe.Subscription): Promise<void> {
  const creatorStatus = mapCreatorSubscriptionStatus(subscription.status)
  const currentPeriodEnd = getCurrentPeriodEnd(subscription)
  const amountCents = subscription.items.data[0]?.price?.unit_amount ?? undefined
  const interval =
    subscription.items.data[0]?.price?.recurring?.interval === "year" ? "YEARLY" : "MONTHLY"

  await prisma.creatorSubscription.updateMany({
    where: { stripeSubscriptionId: subscription.id },
    data: {
      ...(typeof amountCents === "number" ? { amountCents } : {}),
      interval,
      status: creatorStatus,
      canceledAt: creatorStatus === "CANCELED" ? new Date() : null,
      stripeCurrentPeriodEnd: currentPeriodEnd,
    },
  })
}

async function downgradePlatformUserFromStripeSubscription(
  subscription: Stripe.Subscription
): Promise<void> {
  const customerId = getCustomerId(subscription.customer)
  const user = await prisma.user.findFirst({
    where: {
      OR: [
        { stripeSubscriptionId: subscription.id },
        ...(customerId ? [{ stripeCustomerId: customerId }] : []),
      ],
    },
  })

  if (!user) {
    return
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      stripeSubscriptionId: null,
      stripePriceId: null,
      stripeCurrentPeriodEnd: null,
    },
  })

  stripeLogger.info(
    { subscriptionId: subscription.id, userId: user.id },
    "Stripe subscription deleted, user downgraded to free tier"
  )
}

/**
 * Prisma raises P2002 when a write violates a unique constraint. Checked
 * structurally rather than with `instanceof PrismaClientKnownRequestError` so a
 * mocked prisma client in tests can reproduce it.
 */
function isUniqueConstraintViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "P2002"
  )
}

/**
 * Claims a Stripe event by inserting it into the processed-webhook ledger.
 *
 * Returns true if this delivery won the claim and should be processed, false if
 * the event has already been claimed (a Stripe retry).
 *
 * Detection is the unique-constraint violation on the INSERT, never a prior
 * read: Stripe retries arrive concurrently, and two requests that both read
 * "not processed" would both run the handlers.
 */
async function claimStripeEvent(event: Stripe.Event): Promise<boolean> {
  try {
    await prisma.processedWebhookEvent.create({
      data: {
        provider: "stripe",
        eventId: event.id,
        eventType: event.type,
      },
    })
    return true
  } catch (error: unknown) {
    if (isUniqueConstraintViolation(error)) {
      return false
    }
    // Any other database failure must not fall through into the handlers
    // unguarded -- let it propagate so the request 500s and Stripe retries.
    throw error
  }
}

/**
 * Releases a claim so a later Stripe retry can process the event again.
 */
async function releaseStripeEvent(eventId: string): Promise<void> {
  await prisma.processedWebhookEvent
    .deleteMany({ where: { provider: "stripe", eventId } })
    .catch((error: unknown) => {
      stripeLogger.error(
        { err: error, eventId },
        "Failed to release Stripe webhook idempotency claim; retries of this event will be skipped"
      )
    })
}

/**
 * Runs the side effects for a single verified Stripe event.
 *
 * Split out of POST so the idempotency claim below can wrap it in a try/catch
 * without reindenting the handlers. The bodies are unchanged.
 */
async function processStripeEvent(event: Stripe.Event): Promise<NextResponse> {
  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session
    const flowType = session.metadata?.flowType

    if (flowType === "creator_tip") {
      await handleCreatorTipCheckoutCompleted(session)
    } else if (flowType === "creator_subscription") {
      await handleCreatorSubscriptionCheckoutCompleted(session)
    } else if (session.subscription) {
      const subscription = await stripe.subscriptions.retrieve(
        typeof session.subscription === "string" ? session.subscription : session.subscription.id
      )

      if (!("deleted" in subscription && subscription.deleted)) {
        const activeSubscription = subscription as Stripe.Subscription
        if (isPlatformProSubscription(activeSubscription)) {
          const userId = session.metadata?.userId
          const currentPeriodEnd = getCurrentPeriodEnd(activeSubscription)

          if (userId) {
            const userExists = await prisma.user.findUnique({
              where: { id: userId },
              select: { id: true },
            })
            if (!userExists) {
              stripeLogger.error(
                { checkoutSessionId: session.id, userId },
                "[stripe-webhook] User not found for metadata userId"
              )
              // Return 200 to prevent Stripe from retrying for a non-existent user
              return new NextResponse(
                JSON.stringify({ received: true, warning: "user_not_found" }),
                { status: 200 }
              )
            }
            await prisma.user.update({
              where: { id: userId },
              data: {
                stripeSubscriptionId: activeSubscription.id,
                stripeCustomerId: getCustomerId(activeSubscription.customer),
                stripePriceId: activeSubscription.items.data[0]?.price?.id ?? null,
                stripeCurrentPeriodEnd: currentPeriodEnd,
              },
            })

            captureServerEvent(userId, "subscription_started", {
              plan: "pro",
              priceId: activeSubscription.items.data[0]?.price?.id ?? null,
              stripeSubscriptionId: activeSubscription.id,
            })
          }
        }
      }
    }
  }

  if (event.type === "invoice.payment_succeeded") {
    const invoice = event.data.object as Stripe.Invoice
    const subscriptionId = getInvoiceSubscriptionId(invoice)

    if (!subscriptionId) {
      return new NextResponse("Missing subscription reference", { status: 200 })
    }

    const subscription = await stripe.subscriptions.retrieve(subscriptionId)
    if ("deleted" in subscription && subscription.deleted) {
      return new NextResponse("Subscription deleted", { status: 200 })
    }

    const activeSubscription = subscription as Stripe.Subscription
    const currentPeriodEnd = getCurrentPeriodEnd(activeSubscription)

    await prisma.creatorSubscription.updateMany({
      where: { stripeSubscriptionId: activeSubscription.id },
      data: {
        status: "ACTIVE",
        canceledAt: null,
        stripeCurrentPeriodEnd: currentPeriodEnd,
      },
    })

    if (isPlatformProSubscription(activeSubscription)) {
      const customerId = getCustomerId(activeSubscription.customer)
      const user = await prisma.user.findFirst({
        where: {
          OR: [
            { stripeSubscriptionId: activeSubscription.id },
            ...(customerId ? [{ stripeCustomerId: customerId }] : []),
          ],
        },
      })

      if (user) {
        await prisma.user.update({
          where: { id: user.id },
          data: {
            stripePriceId: activeSubscription.items.data[0]?.price?.id ?? null,
            stripeCurrentPeriodEnd: currentPeriodEnd,
          },
        })
      }
    }
  }

  if (event.type === "customer.subscription.updated") {
    const subscription = event.data.object as Stripe.Subscription
    if ("deleted" in subscription && subscription.deleted) {
      return new NextResponse("Subscription deleted", { status: 200 })
    }

    await syncCreatorSubscriptionFromStripe(subscription)

    if (isPlatformProSubscription(subscription)) {
      const customerId = getCustomerId(subscription.customer)
      const user = await prisma.user.findFirst({
        where: {
          OR: [
            { stripeSubscriptionId: subscription.id },
            ...(customerId ? [{ stripeCustomerId: customerId }] : []),
          ],
        },
      })

      if (user) {
        await prisma.user.update({
          where: { id: user.id },
          data: {
            stripePriceId: subscription.items.data[0]?.price?.id ?? null,
            stripeCurrentPeriodEnd: getCurrentPeriodEnd(subscription),
          },
        })

        if (subscription.status === "past_due" || subscription.status === "unpaid") {
          stripeLogger.error(
            { subscriptionId: subscription.id, userId: user.id, status: subscription.status },
            "Stripe subscription is in a problematic state"
          )
        }
      }
    }
  }

  if (event.type === "customer.subscription.deleted") {
    const subscription = event.data.object as Stripe.Subscription

    await prisma.creatorSubscription.updateMany({
      where: { stripeSubscriptionId: subscription.id },
      data: {
        status: "CANCELED",
        canceledAt: new Date(),
        stripeCurrentPeriodEnd: null,
      },
    })

    await downgradePlatformUserFromStripeSubscription(subscription)
  }

  if (event.type === "invoice.payment_failed") {
    const invoice = event.data.object as Stripe.Invoice
    const subscriptionId = getInvoiceSubscriptionId(invoice)

    if (subscriptionId) {
      const subscription = await stripe.subscriptions.retrieve(subscriptionId)

      if (!("deleted" in subscription && subscription.deleted)) {
        const activeSubscription = subscription as Stripe.Subscription
        await prisma.creatorSubscription.updateMany({
          where: { stripeSubscriptionId: activeSubscription.id },
          data: {
            status: "PAUSED",
          },
        })

        if (isPlatformProSubscription(activeSubscription)) {
          const customerId = getCustomerId(activeSubscription.customer)
          const user = await prisma.user.findFirst({
            where: {
              OR: [
                { stripeSubscriptionId: activeSubscription.id },
                ...(customerId ? [{ stripeCustomerId: customerId }] : []),
              ],
            },
          })

          stripeLogger.error(
            { invoiceId: invoice.id, subscriptionId, userId: user?.id ?? null },
            `Stripe payment failed${user ? "" : " (user not found in database)"}`
          )

          if (user?.email) {
            await sendPaymentFailedEmail(user.email, user.name || "there").catch((emailError) => {
              stripeLogger.error(
                { err: emailError, userId: user.id },
                "Failed to send payment failure email"
              )
            })
          }
        }
      }
    } else {
      stripeLogger.error(
        { invoiceId: invoice.id },
        "Stripe payment failed, no subscription reference"
      )
    }
  }

  return new NextResponse(null, { status: 200 })
}

export async function POST(req: Request) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
  if (!webhookSecret) {
    stripeLogger.error("STRIPE_WEBHOOK_SECRET is not configured")
    return new NextResponse("Webhook secret not configured", { status: 500 })
  }

  const headersList = await headers()
  const signature = headersList.get("Stripe-Signature")

  if (!signature) {
    return new NextResponse("Missing Stripe-Signature header", { status: 400 })
  }

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(await req.text(), signature, webhookSecret)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error"
    return new NextResponse(`Webhook Error: ${message}`, { status: 400 })
  }

  // Idempotency guard: Stripe delivers at least once and retries every non-2xx,
  // so the same event id arrives repeatedly and concurrently. The record of
  // "already handled" lives in Postgres, which is mandatory for this app -- not
  // in Redis, which is optional (REDIS_URL) and whose absence used to make this
  // guard silently disappear, leaving the handlers below (tip checkout, creator
  // subscription checkout, subscription upserts) exposed to every retry.
  //
  // Ordering trade-off: AT-LEAST-ONCE. The claim row is committed BEFORE any
  // side effect runs, which is what makes concurrent retries lose the race. If
  // the handlers then throw, the claim is released and the error propagates as a
  // non-2xx so Stripe retries -- work is never silently dropped. The cost is that
  // a handler that fails after a partial side effect will be replayed; the
  // handlers are upserts and updateMany keyed on Stripe ids, so replay converges.
  // At-most-once (claim and never release) was rejected: losing a paid tip or a
  // subscription upgrade is worse than repeating an idempotent write. A hard
  // process kill still leaves an unreleased claim -- that window is not covered
  // by any in-process scheme.
  const claimed = await claimStripeEvent(event)
  if (!claimed) {
    stripeLogger.info({ eventId: event.id, type: event.type }, "Duplicate Stripe event skipped")
    return new NextResponse(null, { status: 200 })
  }

  try {
    return await processStripeEvent(event)
  } catch (error: unknown) {
    await releaseStripeEvent(event.id)
    throw error
  }
}
