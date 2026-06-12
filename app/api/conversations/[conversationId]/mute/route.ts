import { NextResponse, type NextRequest } from "next/server"

import { getCsrfTokenFromRequest, verifyCsrfToken } from "@/app/lib/csrf"
import { apiLogger } from "@/app/lib/logger"
import prisma from "@/app/lib/prismadb"
import { getPusherUserChannel } from "@/app/lib/pusher-channels"
import { pusherServer } from "@/app/lib/pusher-server"
import { apiLimiter, getClientIdentifier } from "@/app/lib/rate-limit"
import getCurrentUser from "@/app/actions/getCurrentUser"

// POST /api/conversations/[conversationId]/mute - Mute a conversation
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  try {
    // CSRF Protection
    const headerToken = request.headers.get("X-CSRF-Token")
    const cookieToken = getCsrfTokenFromRequest(request)

    if (!verifyCsrfToken(headerToken, cookieToken)) {
      return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 })
    }

    const currentUser = await getCurrentUser()

    // Rate limiting
    if (!(await Promise.resolve(apiLimiter.check(getClientIdentifier(request))))) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 })
    }
    const { conversationId } = await params

    if (!currentUser?.id || !currentUser?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Find the conversation
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        users: true,
      },
    })

    if (!conversation) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 })
    }

    // Check if user is part of the conversation
    const isUserInConversation = conversation.users.some(
      (user: { id: string }) => user.id === currentUser.id
    )

    if (!isUserInConversation) {
      return NextResponse.json({ error: "You are not part of this conversation" }, { status: 403 })
    }

    // Fast-path check; the authoritative re-check happens inside the transaction
    const mutedBy = conversation.mutedBy || []
    if (mutedBy.includes(currentUser.id)) {
      return NextResponse.json({ error: "Conversation already muted" }, { status: 400 })
    }

    // Atomically re-read the mute state and perform the update to prevent
    // TOCTOU races where concurrent requests lose each other's writes
    let updatedConversation
    try {
      updatedConversation = await prisma.$transaction(async (tx) => {
        const current = await tx.conversation.findUnique({
          where: { id: conversationId },
          select: { mutedBy: true, mutedAt: true },
        })

        if (!current) {
          throw new Error("NOT_FOUND")
        }

        const currentMutedBy = current.mutedBy || []
        if (currentMutedBy.includes(currentUser.id)) {
          throw new Error("ALREADY_MUTED")
        }

        return tx.conversation.update({
          where: { id: conversationId },
          data: {
            mutedBy: [...currentMutedBy, currentUser.id],
            // Set mutedAt timestamp only if this is the first mute
            mutedAt: currentMutedBy.length === 0 ? new Date() : current.mutedAt,
          },
          include: {
            users: true,
            messages: {
              include: {
                sender: true,
                seen: true,
              },
              orderBy: {
                createdAt: "desc",
              },
              take: 1,
            },
          },
        })
      })
    } catch (txError) {
      if (txError instanceof Error && txError.message === "NOT_FOUND") {
        return NextResponse.json({ error: "Conversation not found" }, { status: 404 })
      }
      if (txError instanceof Error && txError.message === "ALREADY_MUTED") {
        return NextResponse.json({ error: "Conversation already muted" }, { status: 400 })
      }
      throw txError
    }

    // Trigger Pusher event for real-time update (only to the user who muted).
    // Slim payload stays under Pusher's 10KB event limit; failures are logged
    // but never fail the API response.
    try {
      await pusherServer.trigger(getPusherUserChannel(currentUser.id), "conversation:mute", {
        conversationId: updatedConversation.id,
        mutedBy: updatedConversation.mutedBy,
        mutedAt: updatedConversation.mutedAt,
      })
    } catch (pusherError) {
      apiLogger.error({ err: pusherError }, "CONVERSATION_MUTE_PUSHER_ERROR")
    }

    return NextResponse.json(updatedConversation)
  } catch (error: unknown) {
    apiLogger.error({ err: error }, "CONVERSATION_MUTE_ERROR")
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// DELETE /api/conversations/[conversationId]/mute - Unmute a conversation
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  try {
    // CSRF Protection
    const headerToken = request.headers.get("X-CSRF-Token")
    const cookieToken = getCsrfTokenFromRequest(request)

    if (!verifyCsrfToken(headerToken, cookieToken)) {
      return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 })
    }

    // Rate limiting
    if (!(await Promise.resolve(apiLimiter.check(getClientIdentifier(request))))) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 })
    }

    const currentUser = await getCurrentUser()
    const { conversationId } = await params

    if (!currentUser?.id || !currentUser?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Find the conversation
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        users: true,
      },
    })

    if (!conversation) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 })
    }

    // Check if user is part of the conversation
    const isUserInConversation = conversation.users.some(
      (user: { id: string }) => user.id === currentUser.id
    )

    if (!isUserInConversation) {
      return NextResponse.json({ error: "You are not part of this conversation" }, { status: 403 })
    }

    // Fast-path check; the authoritative re-check happens inside the transaction
    const mutedBy = conversation.mutedBy || []
    if (!mutedBy.includes(currentUser.id)) {
      return NextResponse.json({ error: "Conversation is not muted" }, { status: 400 })
    }

    // Atomically re-read the mute state and perform the update to prevent
    // TOCTOU races where concurrent requests lose each other's writes
    let updatedConversation
    try {
      updatedConversation = await prisma.$transaction(async (tx) => {
        const current = await tx.conversation.findUnique({
          where: { id: conversationId },
          select: { mutedBy: true, mutedAt: true },
        })

        if (!current) {
          throw new Error("NOT_FOUND")
        }

        const currentMutedBy = current.mutedBy || []
        if (!currentMutedBy.includes(currentUser.id)) {
          throw new Error("NOT_MUTED")
        }

        // Remove user from mutedBy array
        const updatedMutedBy = currentMutedBy.filter((id: string) => id !== currentUser.id)

        return tx.conversation.update({
          where: { id: conversationId },
          data: {
            mutedBy: updatedMutedBy,
            // Clear mutedAt if no users have it muted anymore
            mutedAt: updatedMutedBy.length === 0 ? null : current.mutedAt,
          },
          include: {
            users: true,
            messages: {
              include: {
                sender: true,
                seen: true,
              },
              orderBy: {
                createdAt: "desc",
              },
              take: 1,
            },
          },
        })
      })
    } catch (txError) {
      if (txError instanceof Error && txError.message === "NOT_FOUND") {
        return NextResponse.json({ error: "Conversation not found" }, { status: 404 })
      }
      if (txError instanceof Error && txError.message === "NOT_MUTED") {
        return NextResponse.json({ error: "Conversation is not muted" }, { status: 400 })
      }
      throw txError
    }

    // Trigger Pusher event for real-time update (only to the user who unmuted).
    // Slim payload stays under Pusher's 10KB event limit; failures are logged
    // but never fail the API response.
    try {
      await pusherServer.trigger(getPusherUserChannel(currentUser.id), "conversation:unmute", {
        conversationId: updatedConversation.id,
        mutedBy: updatedConversation.mutedBy,
        mutedAt: updatedConversation.mutedAt,
      })
    } catch (pusherError) {
      apiLogger.error({ err: pusherError }, "CONVERSATION_UNMUTE_PUSHER_ERROR")
    }

    return NextResponse.json(updatedConversation)
  } catch (error: unknown) {
    apiLogger.error({ err: error }, "CONVERSATION_UNMUTE_ERROR")
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
