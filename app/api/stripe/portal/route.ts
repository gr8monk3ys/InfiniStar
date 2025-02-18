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

    // Look up user's Stripe customer ID
    const user = await prisma.user.findUnique({
      where: { id: currentUser.id },
      select: {
        id: true,
        stripeCustomerId: true,
      },
    })

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    if (!user.stripeCustomerId) {
      return NextResponse.json({ error: "No billing account found" }, { status: 400 })
    }

    let portalSession
    try {
      // Create Stripe billing portal session
      portalSession = await stripe.billingPortal.sessions.create({
        customer: user.stripeCustomerId,
        return_url: `${env.NEXT_PUBLIC_APP_URL}/dashboard`,
      })
    } catch (error) {
      if (!isMissingStripeCustomerError(error)) {
        throw error
      }

      // Stored customer no longer exists for the active Stripe account.
      await prisma.user.update({
        where: { id: user.id },
        data: {
          stripeCustomerId: null,
          stripeSubscriptionId: null,
        },
      })

      return NextResponse.json({ error: "No billing account found" }, { status: 400 })
    }

    return NextResponse.json({ url: portalSession.url })
  } catch (error) {
    stripeLogger.error({ err: error }, "Stripe portal error")
    return new NextResponse("Internal Error", { status: 500 })
  }
}
