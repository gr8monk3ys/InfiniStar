import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"

import { verifyCsrfToken } from "@/app/lib/csrf"
import prisma from "@/app/lib/prismadb"
import { pusherServer } from "@/app/lib/pusher"
import { getPusherConversationChannel } from "@/app/lib/pusher-channels"
import { apiLimiter, getClientIdentifier } from "@/app/lib/rate-limit"
import getCurrentUser from "@/app/actions/getCurrentUser"

const setVariantSchema = z.object({
  index: z.coerce.number().int().min(0),
})

function getCsrfTokens(request: NextRequest): {
  headerToken: string | null
  cookieToken: string | null
} {
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

  return { headerToken, cookieToken }
}

/**
 * PATCH /api/messages/[messageId]/variant
 *
 * Switch the active variant for an AI message (alt replies).
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ messageId: string }> }
) {
  // Rate limiting
  const identifier = getClientIdentifier(request)
  const allowed = await Promise.resolve(apiLimiter.check(identifier))
  if (!allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 })
  }

  // CSRF Protection
  const { headerToken, cookieToken } = getCsrfTokens(request)
  if (!verifyCsrfToken(headerToken, cookieToken)) {
    return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 })
  }

  const currentUser = await getCurrentUser()
  const { messageId } = await params

  if (!currentUser?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json().catch(() => ({}))
  const validation = setVariantSchema.safeParse(body)
  if (!validation.success) {
    return NextResponse.json({ error: validation.error.issues[0].message }, { status: 400 })
  }

  const message = await prisma.message.findUnique({
    where: { id: messageId },
    include: {
      sender: true,
      seen: true,
      replyTo: {
        include: {
          sender: true,
        },
      },
      conversation: {
        select: {
          id: true,
          users: {
            select: {
              id: true,
            },
          },
        },
      },
    },
  })

  if (!message) {
    return NextResponse.json({ error: "Message not found" }, { status: 404 })
  }

  const isMember = message.conversation.users.some(
    (user: { id: string }) => user.id === currentUser.id
  )
  if (!isMember) {
    return NextResponse.json({ error: "Not authorized for this conversation" }, { status: 403 })
  }

  if (!message.isAI) {
    return NextResponse.json({ error: "Only AI messages have variants" }, { status: 400 })
  }

  const variants = Array.isArray(message.variants)
    ? message.variants.filter((variant): variant is string => typeof variant === "string")
    : []

  const { index } = validation.data
  if (variants.length === 0) {
    return NextResponse.json({ error: "No variants available" }, { status: 400 })
  }

  if (index < 0 || index >= variants.length) {
    return NextResponse.json({ error: "Variant index out of range" }, { status: 400 })
  }

  const nextBody = variants[index]

  const updatedMessage = await prisma.message.update({
    where: { id: messageId },
    data: {
      body: nextBody,
      activeVariant: index,
    },
    include: {
      sender: true,
      seen: true,
      replyTo: {
        include: {
          sender: true,
        },
      },
    },
  })

  await pusherServer.trigger(
    getPusherConversationChannel(message.conversation.id),
    "message:update",
    updatedMessage
  )

  return NextResponse.json(updatedMessage)
}
