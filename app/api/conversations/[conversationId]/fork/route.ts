import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"

import { verifyCsrfToken } from "@/app/lib/csrf"
import prisma from "@/app/lib/prismadb"
import { pusherServer } from "@/app/lib/pusher"
import { getPusherUserChannel } from "@/app/lib/pusher-channels"
import { apiLimiter, getClientIdentifier } from "@/app/lib/rate-limit"
import { sanitizePlainText } from "@/app/lib/sanitize"
import getCurrentUser from "@/app/actions/getCurrentUser"

const forkSchema = z.object({
  messageId: z.string().uuid().optional().nullable(),
})

const MAX_FORK_MESSAGES = 200

function validateCsrf(request: NextRequest): boolean {
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

  return verifyCsrfToken(headerToken, cookieToken)
}

/**
 * POST /api/conversations/[conversationId]/fork
 *
 * Create a new AI conversation containing a copy of messages up to a cutoff message.
 * This enables "conversation branching" without mutating the original thread.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  try {
    const identifier = getClientIdentifier(request)
    const allowed = await Promise.resolve(apiLimiter.check(identifier))
    if (!allowed) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 })
    }

    if (!validateCsrf(request)) {
      return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 })
    }

    const currentUser = await getCurrentUser()
    const { conversationId } = await params

    if (!currentUser?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const validation = forkSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json({ error: validation.error.issues[0].message }, { status: 400 })
    }

    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        users: {
          select: { id: true },
        },
      },
    })

    if (!conversation) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 })
    }

    if (!conversation.isAI) {
      return NextResponse.json({ error: "Only AI conversations can be forked" }, { status: 400 })
    }

    const isUserInConversation = conversation.users.some(
      (user: { id: string }) => user.id === currentUser.id
    )
    if (!isUserInConversation) {
      return NextResponse.json({ error: "You are not part of this conversation" }, { status: 403 })
    }

    const { messageId } = validation.data
    let cutoffCreatedAt: Date | null = null

    if (messageId) {
      const cutoffMessage = await prisma.message.findFirst({
        where: { id: messageId, conversationId, isDeleted: false },
        select: { createdAt: true },
      })

      if (!cutoffMessage) {
        return NextResponse.json(
          { error: "Cutoff message not found in this conversation" },
          { status: 400 }
        )
      }

      cutoffCreatedAt = cutoffMessage.createdAt
    }

    const messagesToCopy = await prisma.message.findMany({
      where: {
        conversationId,
        isDeleted: false,
        ...(cutoffCreatedAt ? { createdAt: { lte: cutoffCreatedAt } } : {}),
      },
      orderBy: { createdAt: "asc" },
      take: MAX_FORK_MESSAGES,
      select: {
        id: true,
        body: true,
        image: true,
        createdAt: true,
        editedAt: true,
        senderId: true,
        isAI: true,
        inputTokens: true,
        outputTokens: true,
        reactions: true,
        replyToId: true,
        variants: true,
        activeVariant: true,
      },
    })

    const baseName = conversation.name ? `${conversation.name} (Branch)` : "New Branch"
    const sanitizedName = sanitizePlainText(baseName).slice(0, 100) || "New Branch"

    const newConversation = await prisma.$transaction(async (tx) => {
      const createdConversation = await tx.conversation.create({
        data: {
          name: sanitizedName,
          isAI: true,
          aiModel: conversation.aiModel,
          aiPersonality: conversation.aiPersonality,
          aiSystemPrompt: conversation.aiSystemPrompt,
          characterId: conversation.characterId,
          lastMessageAt: new Date(),
          users: {
            connect: {
              id: currentUser.id,
            },
          },
        },
        include: {
          users: true,
        },
      })

      const idMap = new Map<string, string>()
      const replyPairs: Array<{ newId: string; oldReplyToId: string }> = []

      for (const message of messagesToCopy) {
        const created = await tx.message.create({
          data: {
            body: message.body,
            image: message.image,
            createdAt: message.createdAt,
            editedAt: message.editedAt,
            isAI: message.isAI,
            inputTokens: message.inputTokens,
            outputTokens: message.outputTokens,
            reactions: message.reactions ?? undefined,
            variants: message.variants ?? [],
            activeVariant: message.activeVariant,
            conversationId: createdConversation.id,
            senderId: message.senderId,
            seen: {
              connect: {
                id: currentUser.id,
              },
            },
          },
          select: { id: true },
        })

        idMap.set(message.id, created.id)
        if (message.replyToId) {
          replyPairs.push({ newId: created.id, oldReplyToId: message.replyToId })
        }
      }

      for (const pair of replyPairs) {
        const mappedReplyToId = idMap.get(pair.oldReplyToId)
        if (!mappedReplyToId) continue

        await tx.message.update({
          where: { id: pair.newId },
          data: { replyToId: mappedReplyToId },
        })
      }

      // Fetch a full conversation payload suitable for the sidebar list.
      return tx.conversation.findUnique({
        where: { id: createdConversation.id },
        include: {
          users: true,
          character: true,
          tags: true,
          messages: {
            include: {
              sender: true,
              seen: true,
              replyTo: {
                include: {
                  sender: true,
                },
              },
            },
            orderBy: { createdAt: "asc" },
          },
        },
      })
    })

    if (!newConversation) {
      return NextResponse.json({ error: "Failed to fork conversation" }, { status: 500 })
    }

    await pusherServer.trigger(
      getPusherUserChannel(currentUser.id),
      "conversation:new",
      newConversation
    )

    return NextResponse.json({ id: newConversation.id })
  } catch (error: unknown) {
    console.error("CONVERSATION_FORK_ERROR", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
