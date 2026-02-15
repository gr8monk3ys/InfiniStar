import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"

import { withCsrfProtection } from "@/app/lib/csrf"
import prisma from "@/app/lib/prismadb"
import { getVapidPublicKey } from "@/app/lib/web-push"
import getCurrentUser from "@/app/actions/getCurrentUser"

const subscriptionSchema = z.object({
  endpoint: z.string().url(),
  expirationTime: z.number().nullable().optional(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
})

const subscribeBodySchema = z.object({
  subscription: subscriptionSchema,
  userAgent: z.string().min(1).max(512).optional(),
})

const unsubscribeBodySchema = z.object({
  endpoint: z.string().url().optional(),
})

export async function GET(_request: NextRequest) {
  try {
    const currentUser = await getCurrentUser()

    if (!currentUser?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const subscriptionCount = await prisma.pushSubscription.count({
      where: { userId: currentUser.id },
    })

    const publicKey = getVapidPublicKey()
    const configured = Boolean(publicKey && process.env.VAPID_PRIVATE_KEY)

    return NextResponse.json({
      configured,
      publicKey,
      subscriptionCount,
    })
  } catch (error: unknown) {
    console.error("PUSH_STATUS_GET_ERROR", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export const POST = withCsrfProtection(async (request: Request) => {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const parsed = subscribeBodySchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
    }

    const { subscription, userAgent } = parsed.data

    await prisma.pushSubscription.upsert({
      where: { endpoint: subscription.endpoint },
      create: {
        endpoint: subscription.endpoint,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
        userAgent: userAgent ?? null,
        user: { connect: { id: currentUser.id } },
      },
      update: {
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
        userAgent: userAgent ?? null,
        userId: currentUser.id,
      },
    })

    return NextResponse.json({ ok: true })
  } catch (error: unknown) {
    console.error("PUSH_SUBSCRIBE_ERROR", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
})

export const DELETE = withCsrfProtection(async (request: Request) => {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    let body: unknown = {}
    try {
      body = await request.json()
    } catch {
      // Allow DELETE with no JSON body.
      body = {}
    }

    const parsed = unsubscribeBodySchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
    }

    const { endpoint } = parsed.data

    const result = endpoint
      ? await prisma.pushSubscription.deleteMany({
          where: { userId: currentUser.id, endpoint },
        })
      : await prisma.pushSubscription.deleteMany({
          where: { userId: currentUser.id },
        })

    return NextResponse.json({ ok: true, deleted: result.count })
  } catch (error: unknown) {
    console.error("PUSH_UNSUBSCRIBE_ERROR", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
})
