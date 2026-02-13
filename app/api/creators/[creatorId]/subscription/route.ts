import { NextResponse, type NextRequest } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { z } from "zod"

import { isValidSubscriptionPlan } from "@/app/lib/creator-monetization"
import { verifyCsrfToken } from "@/app/lib/csrf"
import prisma from "@/app/lib/prismadb"
import { sanitizePlainText } from "@/app/lib/sanitize"
import { stripe } from "@/app/lib/stripe"

const subscriptionSchema = z.object({
  tierName: z.string().min(1).max(60),
  amountCents: z.number().int().positive(),
  interval: z.enum(["MONTHLY", "YEARLY"]),
})

function getCookieToken(request: NextRequest): string | null {
  const cookieHeader = request.headers.get("cookie")
  if (!cookieHeader) {
    return null
  }

  const cookies = cookieHeader.split(";").reduce(
    (acc, cookie) => {
      const [key, value] = cookie.trim().split("=")
      acc[key] = value
      return acc
    },
    {} as Record<string, string>
  )

  return cookies["csrf-token"] || null
}

async function getCurrentUserProfile(): Promise<{
  id: string
  email: string | null
  name: string | null
  stripeCustomerId: string | null
} | null> {
  const { userId } = await auth()
  if (!userId) {
    return null
  }

  return prisma.user.findUnique({
    where: { clerkId: userId },
    select: { id: true, email: true, name: true, stripeCustomerId: true },
  })
}

export async function GET(_: NextRequest, { params }: { params: Promise<{ creatorId: string }> }) {
  const supporter = await getCurrentUserProfile()
  if (!supporter?.id) {
    return NextResponse.json({ subscription: null }, { status: 200 })
  }

  const { creatorId } = await params
  const subscription = await prisma.creatorSubscription.findUnique({
    where: {
      supporterId_creatorId: {
        supporterId: supporter.id,
        creatorId,
      },
    },
  })

  return NextResponse.json({ subscription }, { status: 200 })
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ creatorId: string }> }
) {
  const supporter = await getCurrentUserProfile()
  if (!supporter?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const headerToken = request.headers.get("X-CSRF-Token")
  const cookieToken = getCookieToken(request)
  if (!verifyCsrfToken(headerToken, cookieToken)) {
    return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 })
  }

  const { creatorId } = await params
  if (creatorId === supporter.id) {
    return NextResponse.json({ error: "You cannot subscribe to yourself" }, { status: 400 })
  }

  const creator = await prisma.user.findUnique({
    where: { id: creatorId },
    select: { id: true, name: true },
  })
  if (!creator) {
    return NextResponse.json({ error: "Creator not found" }, { status: 404 })
  }

  const body = await request.json()
  const validation = subscriptionSchema.safeParse(body)
  if (!validation.success) {
    return NextResponse.json({ error: validation.error.issues[0].message }, { status: 400 })
  }

  const { tierName, amountCents, interval } = validation.data
  if (!isValidSubscriptionPlan(tierName, amountCents, interval)) {
    return NextResponse.json({ error: "Unsupported subscription plan" }, { status: 400 })
  }

  let customerId = supporter.stripeCustomerId
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: supporter.email ?? undefined,
      name: supporter.name ?? undefined,
      metadata: {
        userId: supporter.id,
      },
    })

    customerId = customer.id
    await prisma.user.update({
      where: { id: supporter.id },
      data: {
        stripeCustomerId: customerId,
      },
    })
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
  const normalizedInterval = interval === "YEARLY" ? "year" : "month"
  const sanitizedTierName = sanitizePlainText(tierName) || tierName

  const checkoutSession = await stripe.checkout.sessions.create({
    mode: "subscription",
    payment_method_types: ["card"],
    customer: customerId,
    line_items: [
      {
        price_data: {
          currency: "usd",
          recurring: {
            interval: normalizedInterval,
          },
          unit_amount: amountCents,
          product_data: {
            name: `${sanitizedTierName} support for ${creator.name || "creator"}`,
            description: "Recurring creator support membership",
          },
        },
        quantity: 1,
      },
    ],
    metadata: {
      flowType: "creator_subscription",
      supporterId: supporter.id,
      creatorId: creator.id,
      tierName: sanitizedTierName,
      amountCents: String(amountCents),
      interval,
    },
    subscription_data: {
      metadata: {
        flowType: "creator_subscription",
        supporterId: supporter.id,
        creatorId: creator.id,
      },
    },
    success_url: `${appUrl}/creators/${creator.id}?support=subscription-success`,
    cancel_url: `${appUrl}/creators/${creator.id}?support=subscription-canceled`,
  })

  if (!checkoutSession.url) {
    return NextResponse.json({ error: "Unable to start checkout" }, { status: 500 })
  }

  const subscription = await prisma.creatorSubscription.upsert({
    where: {
      supporterId_creatorId: {
        supporterId: supporter.id,
        creatorId: creator.id,
      },
    },
    update: {
      tierName: sanitizedTierName,
      amountCents,
      interval,
      status: "PAUSED",
      canceledAt: null,
      startedAt: new Date(),
      stripeCheckoutSessionId: checkoutSession.id,
      stripeCustomerId: customerId,
    },
    create: {
      supporterId: supporter.id,
      creatorId: creator.id,
      tierName: sanitizedTierName,
      amountCents,
      interval,
      status: "PAUSED",
      currency: "USD",
      stripeCheckoutSessionId: checkoutSession.id,
      stripeCustomerId: customerId,
    },
  })

  return NextResponse.json(
    {
      subscription,
      url: checkoutSession.url,
    },
    { status: 201 }
  )
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ creatorId: string }> }
) {
  const supporter = await getCurrentUserProfile()
  if (!supporter?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const headerToken = request.headers.get("X-CSRF-Token")
  const cookieToken = getCookieToken(request)
  if (!verifyCsrfToken(headerToken, cookieToken)) {
    return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 })
  }

  const { creatorId } = await params
  const subscription = await prisma.creatorSubscription.findUnique({
    where: {
      supporterId_creatorId: {
        supporterId: supporter.id,
        creatorId,
      },
    },
  })
  if (!subscription) {
    return NextResponse.json({ error: "Subscription not found" }, { status: 404 })
  }

  if (subscription.stripeSubscriptionId) {
    await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
      cancel_at_period_end: true,
    })
  }

  const canceledSubscription = await prisma.creatorSubscription.update({
    where: {
      supporterId_creatorId: {
        supporterId: supporter.id,
        creatorId,
      },
    },
    data: {
      status: "CANCELED",
      canceledAt: new Date(),
    },
  })

  return NextResponse.json({ subscription: canceledSubscription }, { status: 200 })
}
