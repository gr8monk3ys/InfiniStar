import { NextResponse } from "next/server"
import { z } from "zod"

import { guard } from "@/app/lib/guarded-route"
import prisma from "@/app/lib/prismadb"
import { apiLimiter } from "@/app/lib/rate-limit"
import { getVapidPublicKey } from "@/app/lib/web-push"

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

export const GET = guard({ limiter: apiLimiter }, async ({ user }) => {
  const subscriptionCount = await prisma.pushSubscription.count({
    where: { userId: user.id },
  })

  const publicKey = getVapidPublicKey()
  const configured = Boolean(publicKey && process.env.VAPID_PRIVATE_KEY)

  return NextResponse.json({
    configured,
    publicKey,
    subscriptionCount,
  })
})

export const POST = guard(
  { limiter: apiLimiter, body: subscribeBodySchema },
  async ({ user, body }) => {
    const { subscription, userAgent } = body

    await prisma.pushSubscription.upsert({
      where: { endpoint: subscription.endpoint },
      create: {
        endpoint: subscription.endpoint,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
        userAgent: userAgent ?? null,
        user: { connect: { id: user.id } },
      },
      update: {
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
        userAgent: userAgent ?? null,
        userId: user.id,
      },
    })

    return NextResponse.json({ ok: true })
  }
)

/**
 * DELETE keeps its own body parsing rather than declaring `body`: unsubscribing
 * every endpoint is a bodyless DELETE, and the guard 400s when there is no JSON
 * to parse.
 */
export const DELETE = guard({ limiter: apiLimiter }, async ({ user, request }) => {
  let raw: unknown = {}
  try {
    raw = await request.json()
  } catch {
    // Allow DELETE with no JSON body.
    raw = {}
  }

  const parsed = unsubscribeBodySchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
  }

  const { endpoint } = parsed.data

  const result = endpoint
    ? await prisma.pushSubscription.deleteMany({
        where: { userId: user.id, endpoint },
      })
    : await prisma.pushSubscription.deleteMany({
        where: { userId: user.id },
      })

  return NextResponse.json({ ok: true, deleted: result.count })
})
