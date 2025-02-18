import { NextResponse, type NextRequest } from "next/server"
import { env } from "@/env.mjs"

import { getCsrfTokenFromRequest, verifyCsrfToken } from "@/app/lib/csrf"
import { stripeLogger } from "@/app/lib/logger"
import prisma from "@/app/lib/prismadb"
import { apiLimiter, getClientIdentifier } from "@/app/lib/rate-limit"
import { stripe } from "@/app/lib/stripe"
import getCurrentUser from "@/app/actions/getCurrentUser"

function isMissingStripeCustomerError(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false
  }

  const stripeError = error as {
    type?: string
    code?: string
    param?: string
  }

  return (
    stripeError.type === "StripeInvalidRequestError" &&
    stripeError.code === "resource_missing" &&
    (stripeError.param === "customer" ||
      stripeError.param === "id" ||
      stripeError.param === undefined)
  )
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Rate limiting
    const identifier = getClientIdentifier(request)
    const allowed = await Promise.resolve(apiLimiter.check(identifier))
    if (!allowed) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429 }
      )
    }

    // CSRF Protection
    const headerToken = request.headers.get("X-CSRF-Token")
    const cookieToken = getCsrfTokenFromRequest(request)

    if (!verifyCsrfToken(headerToken, cookieToken)) {
      return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 })
    }

    // Authentication
    const currentUser = await getCurrentUser()

    if (!currentUser?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check if user already has an active subscription
    const user = await prisma.user.findUnique({
      where: { id: currentUser.id },
      select: {
        id: true,
        email: true,
        name: true,
        stripeCustomerId: true,
        stripeSubscriptionId: true,
      },
    })

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    if (user.stripeSubscriptionId) {
      return NextResponse.json(
        { error: "User already has an active subscription" },
        { status: 400 }
      )
    }

    // Create or retrieve Stripe customer
    let customerId = user.stripeCustomerId

    // A customer id may become stale if Stripe accounts/keys are rotated.
    // Verify it before using it so checkout can self-heal instead of 500ing.
    if (customerId) {
      try {
        const existingCustomer = await stripe.customers.retrieve(customerId)
        if ("deleted" in existingCustomer && existingCustomer.deleted) {
          customerId = null
        }
      } catch (error) {
        if (isMissingStripeCustomerError(error)) {
          customerId = null
        } else {
          throw error
        }
      }
    }

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email ?? undefined,
        name: user.name ?? undefined,
        metadata: {
          userId: user.id,
        },
      })

      customerId = customer.id

      await prisma.user.update({
        where: { id: user.id },
        data: {
          stripeCustomerId: customerId,
          stripeSubscriptionId: null,
        },
      })
    }

    // Create Stripe checkout session
    const checkoutSession = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      customer: customerId,
      line_items: [
        {
          price: env.STRIPE_PRO_MONTHLY_PLAN_ID,
          quantity: 1,
        },
      ],
      success_url: `${env.NEXT_PUBLIC_APP_URL}/dashboard?upgraded=true`,
      cancel_url: `${env.NEXT_PUBLIC_APP_URL}/pricing`,
      metadata: {
        userId: user.id,
      },
    })

    return NextResponse.json({ url: checkoutSession.url })
  } catch (error) {
    stripeLogger.error({ err: error }, "Stripe checkout error")
    return new NextResponse("Internal Error", { status: 500 })
  }
}
