import { headers } from "next/headers"
import { Webhook } from "svix"

import { sendWelcomeEmail } from "@/app/lib/email"
import { authLogger } from "@/app/lib/logger"
import prisma from "@/app/lib/prismadb"

interface ClerkWebhookEvent {
  type: string
  data: {
    id: string
    email_addresses: Array<{ email_address: string }>
    first_name: string | null
    last_name: string | null
    image_url: string | null
  }
}

export async function POST(req: Request): Promise<Response> {
  const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET

  if (!WEBHOOK_SECRET) {
    return new Response("Webhook secret not configured", { status: 500 })
  }

  const headerPayload = await headers()
  const svixId = headerPayload.get("svix-id")
  const svixTimestamp = headerPayload.get("svix-timestamp")
  const svixSignature = headerPayload.get("svix-signature")

  if (!svixId || !svixTimestamp || !svixSignature) {
    return new Response("Missing svix headers", { status: 400 })
  }

  const body = await req.text()

  const wh = new Webhook(WEBHOOK_SECRET)
  let evt: ClerkWebhookEvent

  try {
    evt = wh.verify(body, {
      "svix-id": svixId,
      "svix-timestamp": svixTimestamp,
      "svix-signature": svixSignature,
    }) as ClerkWebhookEvent
  } catch {
    return new Response("Invalid webhook signature", { status: 400 })
  }

  const { type: eventType, data } = evt

  try {
    switch (eventType) {
      case "user.created": {
        const email = data.email_addresses[0]?.email_address
        const name = `${data.first_name || ""} ${data.last_name || ""}`.trim() || null

        await prisma.user.upsert({
          where: { clerkId: data.id },
          update: {
            email,
            name,
            image: data.image_url,
          },
          create: {
            clerkId: data.id,
            email,
            name,
            image: data.image_url,
            emailVerified: new Date(),
          },
        })

        // Fire-and-forget: don't let email failure fail the webhook
        if (email) {
          void sendWelcomeEmail(email, name || "there")
        }
        break
      }

      case "user.updated": {
        const email = data.email_addresses[0]?.email_address
        const name = `${data.first_name || ""} ${data.last_name || ""}`.trim() || null

        // Use upsert to avoid P2025 if user.created was missed (e.g. webhook replay gap).
        await prisma.user.upsert({
          where: { clerkId: data.id },
          update: {
            email,
            name,
            image: data.image_url,
          },
          create: {
            clerkId: data.id,
            email,
            name,
            image: data.image_url,
            emailVerified: new Date(),
          },
        })
        break
      }

      case "user.deleted": {
        await prisma.user
          .delete({
            where: { clerkId: data.id },
          })
          .catch(() => {
            // User may not exist in our DB yet
          })
        break
      }
    }
  } catch (error) {
    authLogger.error({ err: error, eventType }, "Error processing Clerk webhook")
    return new Response("Webhook processing error", { status: 500 })
  }

  return new Response("OK", { status: 200 })
}
