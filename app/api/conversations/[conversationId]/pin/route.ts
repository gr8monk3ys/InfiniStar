import { NextResponse, type NextRequest } from "next/server"

import { verifyCsrfToken } from "@/app/lib/csrf"
import prisma from "@/app/lib/prismadb"
import { pusherServer } from "@/app/lib/pusher"
import getCurrentUser from "@/app/actions/getCurrentUser"

// Helper function to validate CSRF token
function validateCsrf(request: NextRequest): boolean {
  const headerToken = request.headers.get("X-CSRF-Token")
  const cookieHeader = request.headers.get("cookie")
  let cookieToken: string | null = null

  if (cookieHeader) {
    const cookies = cookieHeader.split(";").reduce((acc, cookie) => {
      const [key, value] = cookie.trim().split("=")
      acc[key] = value
      return acc
    }, {} as Record<string, string>)
    cookieToken = cookies["csrf-token"] || null
  }

  return verifyCsrfToken(headerToken, cookieToken)
}

// POST /api/conversations/[conversationId]/pin - Pin a conversation
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  try {
    // CSRF Protection
    if (!validateCsrf(request)) {
      return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 })
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
    const isUserInConversation = conversation.users.some((user: { id: string }) => user.id === currentUser.id)

    if (!isUserInConversation) {
      return NextResponse.json({ error: "You are not part of this conversation" }, { status: 403 })
    }

    // Check if already pinned by this user
    const pinnedBy = conversation.pinnedBy || []
    if (pinnedBy.includes(currentUser.id)) {
      return NextResponse.json({ error: "Conversation already pinned" }, { status: 400 })
    }

    // Check pin limit (max 5 pinned conversations per user)
    const pinnedConversationsCount = await prisma.conversation.count({
      where: {
        pinnedBy: {
          has: currentUser.id,
        },
      },
    })

    if (pinnedConversationsCount >= 5) {
      return NextResponse.json(
        { error: "You can only pin up to 5 conversations. Unpin one to pin another." },
        { status: 400 }
      )
    }

    // Add user to pinnedBy array
    const updatedPinnedBy = [...pinnedBy, currentUser.id]

    // Update conversation
    const updatedConversation = await prisma.conversation.update({
      where: { id: conversationId },
      data: {
        pinnedBy: updatedPinnedBy,
        // Set pinnedAt timestamp only if this is the first pin
        pinnedAt: pinnedBy.length === 0 ? new Date() : conversation.pinnedAt,
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

    // Trigger Pusher event for real-time update (only to the user who pinned)
    await pusherServer.trigger(`user-${currentUser.id}`, "conversation:pin", updatedConversation)

    return NextResponse.json(updatedConversation)
  } catch (error: unknown) {
    console.error("CONVERSATION_PIN_ERROR", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// DELETE /api/conversations/[conversationId]/pin - Unpin a conversation
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  try {
    // CSRF Protection
    if (!validateCsrf(request)) {
      return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 })
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
    const isUserInConversation = conversation.users.some((user: { id: string }) => user.id === currentUser.id)

    if (!isUserInConversation) {
      return NextResponse.json({ error: "You are not part of this conversation" }, { status: 403 })
    }

    // Check if pinned by this user
    const pinnedBy = conversation.pinnedBy || []
    if (!pinnedBy.includes(currentUser.id)) {
      return NextResponse.json({ error: "Conversation is not pinned" }, { status: 400 })
    }

    // Remove user from pinnedBy array
    const updatedPinnedBy = pinnedBy.filter((id: string) => id !== currentUser.id)

    // Update conversation
    const updatedConversation = await prisma.conversation.update({
      where: { id: conversationId },
      data: {
        pinnedBy: updatedPinnedBy,
        // Clear pinnedAt if no users have it pinned anymore
        pinnedAt: updatedPinnedBy.length === 0 ? null : conversation.pinnedAt,
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

    // Trigger Pusher event for real-time update (only to the user who unpinned)
    await pusherServer.trigger(`user-${currentUser.id}`, "conversation:unpin", updatedConversation)

    return NextResponse.json(updatedConversation)
  } catch (error: unknown) {
    console.error("CONVERSATION_UNPIN_ERROR", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
