import { headers } from "next/headers"
import { NextResponse } from "next/server"
import type Stripe from "stripe"

import prisma from "@/app/lib/prismadb"
import { stripe } from "@/app/lib/stripe"

export async function POST(req: Request) {
  const headersList = await headers()
  const signature = headersList.get("Stripe-Signature") as string

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(
      await req.text(),
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    )
  } catch (error: any) {
    return new NextResponse(`Webhook Error: ${error.message}`, { status: 400 })
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session
    const subscription = await stripe.subscriptions.retrieve(session.subscription as string)
    const userId = session?.metadata?.userId

    if (userId) {
      await prisma.user.update({
        where: { id: userId },
        data: {
          stripeSubscriptionId: subscription.id,
          stripeCustomerId: subscription.customer as string,
          stripePriceId: subscription.items.data[0].price.id,
          stripeCurrentPeriodEnd: new Date(subscription.current_period_end * 1000),
        },
      })
    }
  }

  if (event.type === "invoice.payment_succeeded") {
    const invoice = event.data.object as Stripe.Invoice
    const subscriptionId = invoice.subscription as string

    // Get the subscription to find the customer
    const subscription = await stripe.subscriptions.retrieve(subscriptionId)

    // Find user by Stripe customer ID
    const user = await prisma.user.findUnique({
      where: {
        stripeCustomerId: subscription.customer as string,
      },
    })

    if (user) {
      await prisma.user.update({
        where: {
          id: user.id,
        },
        data: {
          stripePriceId: subscription.items.data[0].price.id,
          stripeCurrentPeriodEnd: new Date(subscription.current_period_end * 1000),
        },
      })
    }
  }

  return new NextResponse(null, { status: 200 })
}
