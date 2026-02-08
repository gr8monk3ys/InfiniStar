import { headers } from "next/headers"
import { NextResponse } from "next/server"
import type Stripe from "stripe"

import { stripeLogger } from "@/app/lib/logger"
import prisma from "@/app/lib/prismadb"
import { stripe } from "@/app/lib/stripe"

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
    const subscription = await stripe.subscriptions.retrieve(session.subscription as string)
    const userId = session?.metadata?.userId

    if ("deleted" in subscription && subscription.deleted) {
      return new NextResponse("Subscription deleted", { status: 200 })
    }

    const activeSubscription = subscription as Stripe.Subscription

    const currentPeriodEnd = activeSubscription.items.data[0]?.current_period_end
      ? new Date(activeSubscription.items.data[0].current_period_end * 1000)
      : null

    if (userId) {
      await prisma.user.update({
        where: { id: userId },
        data: {
          stripeSubscriptionId: activeSubscription.id,
          stripeCustomerId: activeSubscription.customer as string,
          stripePriceId: activeSubscription.items.data[0].price.id,
          stripeCurrentPeriodEnd: currentPeriodEnd,
        },
      })
    }
  }

  if (event.type === "invoice.payment_succeeded") {
    const invoice = event.data.object as Stripe.Invoice
    const subscriptionRef = invoice.parent?.subscription_details?.subscription
    const subscriptionId =
      typeof subscriptionRef === "string" ? subscriptionRef : subscriptionRef?.id

    if (!subscriptionId) {
      return new NextResponse("Missing subscription reference", { status: 200 })
    }

    // Get the subscription to find the customer
    const subscription = await stripe.subscriptions.retrieve(subscriptionId)

    if ("deleted" in subscription && subscription.deleted) {
      return new NextResponse("Subscription deleted", { status: 200 })
    }

    const activeSubscription = subscription as Stripe.Subscription

    const currentPeriodEnd = activeSubscription.items.data[0]?.current_period_end
      ? new Date(activeSubscription.items.data[0].current_period_end * 1000)
      : null

    // Find user by Stripe customer ID
    const user = await prisma.user.findUnique({
      where: {
        stripeCustomerId: activeSubscription.customer as string,
      },
    })

    if (user) {
      await prisma.user.update({
        where: {
          id: user.id,
        },
        data: {
          stripePriceId: activeSubscription.items.data[0].price.id,
          stripeCurrentPeriodEnd: currentPeriodEnd,
        },
      })
    }
  }

  if (event.type === "customer.subscription.updated") {
    const subscription = event.data.object as Stripe.Subscription

    if ("deleted" in subscription && subscription.deleted) {
      return new NextResponse("Subscription deleted", { status: 200 })
    }

    const customerId =
      typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id

    const user = await prisma.user.findUnique({
      where: { stripeCustomerId: customerId },
    })

    if (user) {
      const currentPeriodEnd = subscription.items.data[0]?.current_period_end
        ? new Date(subscription.items.data[0].current_period_end * 1000)
        : null

      await prisma.user.update({
        where: { id: user.id },
        data: {
          stripePriceId: subscription.items.data[0].price.id,
          stripeCurrentPeriodEnd: currentPeriodEnd,
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

  if (event.type === "customer.subscription.deleted") {
    const subscription = event.data.object as Stripe.Subscription

    const customerId =
      typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id

    const user = await prisma.user.findUnique({
      where: { stripeCustomerId: customerId },
    })

    if (user) {
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
  }

  if (event.type === "invoice.payment_failed") {
    const invoice = event.data.object as Stripe.Invoice
    const subscriptionRef = invoice.parent?.subscription_details?.subscription
    const subscriptionId =
      typeof subscriptionRef === "string" ? subscriptionRef : subscriptionRef?.id

    if (subscriptionId) {
      const subscription = await stripe.subscriptions.retrieve(subscriptionId)

      if (!("deleted" in subscription && subscription.deleted)) {
        const customerId =
          typeof subscription.customer === "string"
            ? subscription.customer
            : subscription.customer.id

        const user = await prisma.user.findUnique({
          where: { stripeCustomerId: customerId },
        })

        stripeLogger.error(
          { invoiceId: invoice.id, subscriptionId, userId: user?.id ?? null },
          `Stripe payment failed${user ? "" : " (user not found in database)"}`
        )
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
