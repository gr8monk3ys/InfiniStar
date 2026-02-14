import { NextResponse, type NextRequest } from "next/server"
import { env } from "@/env.mjs"
import { auth } from "@clerk/nextjs/server"

import { verifyCsrfToken } from "@/app/lib/csrf"
import prisma from "@/app/lib/prismadb"
import { apiLimiter, getClientIdentifier } from "@/app/lib/rate-limit"
import { stripe } from "@/app/lib/stripe"

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
    const cookieHeader = request.headers.get("cookie")
    let cookieToken: string | null = null

    if (cookieHeader) {
      const cookies = cookieHeader.split(";").reduce(
        (acc, cookie) => {
          const [key, value] = cookie.trim().split("=")
          acc[key] = value
          return acc
        },
        {} as Record<string, string>
      )
      cookieToken = cookies["csrf-token"] || null
    }

    if (!verifyCsrfToken(headerToken, cookieToken)) {
      return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 })
    }

    // Authentication
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Look up user's Stripe customer ID
    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
      select: {
        stripeCustomerId: true,
      },
    })

    if (!user?.stripeCustomerId) {
      return NextResponse.json({ error: "No billing account found" }, { status: 400 })
    }

    // Create Stripe billing portal session
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: `${env.NEXT_PUBLIC_APP_URL}/dashboard`,
    })

    return NextResponse.json({ url: portalSession.url })
  } catch (error) {
    console.error("[STRIPE_PORTAL_ERROR]", error)
    return new NextResponse("Internal Error", { status: 500 })
  }
}
