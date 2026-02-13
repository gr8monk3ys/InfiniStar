import { headers } from "next/headers"
import { NextResponse } from "next/server"
import type Stripe from "stripe"

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
            await prisma.user.update({
              where: { id: userId },
              data: {
                stripeSubscriptionId: activeSubscription.id,
                stripeCustomerId: getCustomerId(activeSubscription.customer),
                stripePriceId: activeSubscription.items.data[0]?.price?.id ?? null,
                stripeCurrentPeriodEnd: currentPeriodEnd,
              },
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
