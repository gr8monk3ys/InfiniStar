import webpush from "web-push"

import { config } from "@/app/lib/config"
import { apiLogger } from "@/app/lib/logger"
import prisma from "@/app/lib/prismadb"

export type WebPushPayload = {
  title: string
  body: string
  url?: string
  tag?: string
}

function isConfigured(): boolean {
  return Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY)
}

export function getVapidPublicKey(): string | null {
  return process.env.VAPID_PUBLIC_KEY || null
}

// `web-push` stores VAPID details globally, and `setVapidDetails` decodes and
// validates both keys on every call, so it runs once per process rather than
// once per send.
let webPushConfigured = false

function configureWebPush() {
  if (webPushConfigured || !isConfigured()) return

  const subject = process.env.VAPID_SUBJECT || config.appUrl

  webpush.setVapidDetails(subject, process.env.VAPID_PUBLIC_KEY!, process.env.VAPID_PRIVATE_KEY!)
  webPushConfigured = true
}

function buildSubscription(input: { endpoint: string; p256dh: string; auth: string }) {
  return {
    endpoint: input.endpoint,
    keys: {
      p256dh: input.p256dh,
      auth: input.auth,
    },
  }
}

export async function sendWebPushToUser(
  userId: string,
  payload: WebPushPayload
): Promise<{ sent: number; failed: number; configured: boolean }> {
  if (!isConfigured()) {
    return { sent: 0, failed: 0, configured: false }
  }

  configureWebPush()

  const subscriptions = await prisma.pushSubscription.findMany({
    where: { userId },
    select: {
      id: true,
      endpoint: true,
      p256dh: true,
      auth: true,
    },
  })

  if (subscriptions.length === 0) {
    return { sent: 0, failed: 0, configured: true }
  }

  const body = JSON.stringify({
    title: payload.title,
    body: payload.body,
    url: payload.url ?? "/",
    tag: payload.tag,
    icon: "/icon-192.png",
  })

  const results = await Promise.allSettled(
    subscriptions.map(async (sub) => {
      const subscription = buildSubscription(sub)
      await webpush.sendNotification(subscription, body)
      return sub.id
    })
  )

  let sent = 0
  let failed = 0
  const staleSubscriptionIds: string[] = []

  for (let i = 0; i < results.length; i++) {
    const result = results[i]
    const sub = subscriptions[i]

    if (result.status === "fulfilled") {
      sent += 1
      continue
    }

    failed += 1

    const err = result.reason as { statusCode?: number } | undefined
    if (err?.statusCode === 404 || err?.statusCode === 410) {
      staleSubscriptionIds.push(sub.id)
    }
  }

  if (staleSubscriptionIds.length > 0) {
    try {
      await prisma.pushSubscription.deleteMany({
        where: { id: { in: staleSubscriptionIds } },
      })
    } catch (error) {
      apiLogger.warn({ error }, "WEB_PUSH_STALE_SUBSCRIPTION_DELETE_ERROR")
    }
  }

  return { sent, failed, configured: true }
}
