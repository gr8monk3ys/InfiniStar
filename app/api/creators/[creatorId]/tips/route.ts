import { NextResponse, type NextRequest } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { z } from "zod"

import { isValidTipAmount } from "@/app/lib/creator-monetization"
import { verifyCsrfToken } from "@/app/lib/csrf"
import prisma from "@/app/lib/prismadb"
import { sanitizePlainText } from "@/app/lib/sanitize"
import { stripe } from "@/app/lib/stripe"

const tipSchema = z.object({
  amountCents: z.number().int().positive(),
  note: z.string().max(400).optional(),
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

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ creatorId: string }> }
) {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const headerToken = request.headers.get("X-CSRF-Token")
  const cookieToken = getCookieToken(request)
  if (!verifyCsrfToken(headerToken, cookieToken)) {
    return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 })
  }

  const currentUser = await prisma.user.findUnique({
    where: { clerkId: userId },
    select: { id: true, email: true, name: true, stripeCustomerId: true },
  })
  if (!currentUser) {
    return NextResponse.json({ error: "User not found" }, { status: 401 })
  }

  const { creatorId } = await params
  const creator = await prisma.user.findUnique({
    where: { id: creatorId },
    select: { id: true, name: true },
  })
  if (!creator) {
    return NextResponse.json({ error: "Creator not found" }, { status: 404 })
  }
  if (creator.id === currentUser.id) {
    return NextResponse.json({ error: "You cannot tip yourself" }, { status: 400 })
  }

  const body = await request.json()
  const validation = tipSchema.safeParse(body)
  if (!validation.success) {
    return NextResponse.json({ error: validation.error.issues[0].message }, { status: 400 })
  }

  const { amountCents, note } = validation.data
  if (!isValidTipAmount(amountCents)) {
    return NextResponse.json({ error: "Unsupported tip amount" }, { status: 400 })
  }

  let customerId = currentUser.stripeCustomerId
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: currentUser.email ?? undefined,
      name: currentUser.name ?? undefined,
      metadata: {
        userId: currentUser.id,
      },
    })

    customerId = customer.id
    await prisma.user.update({
      where: { id: currentUser.id },
      data: {
        stripeCustomerId: customerId,
      },
    })
  }

  const sanitizedNote = note ? sanitizePlainText(note) : null
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"

  const checkoutSession = await stripe.checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card"],
    customer: customerId,
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: {
            name: `Tip for ${creator.name || "creator"}`,
            description: "Creator support tip",
          },
          unit_amount: amountCents,
        },
        quantity: 1,
      },
    ],
    metadata: {
      flowType: "creator_tip",
      supporterId: currentUser.id,
      creatorId: creator.id,
      amountCents: String(amountCents),
      note: sanitizedNote || "",
    },
    success_url: `${appUrl}/creators/${creator.id}?support=tip-success`,
    cancel_url: `${appUrl}/creators/${creator.id}?support=tip-canceled`,
  })

  if (!checkoutSession.url) {
    return NextResponse.json({ error: "Unable to start checkout" }, { status: 500 })
  }

  const tip = await prisma.creatorTip.create({
    data: {
      supporterId: currentUser.id,
      creatorId: creator.id,
      amountCents,
      note: sanitizedNote,
      currency: "USD",
      status: "PENDING",
      stripeCheckoutSessionId: checkoutSession.id,
    },
  })

  return NextResponse.json(
    {
      tip,
      url: checkoutSession.url,
    },
    { status: 201 }
  )
}
