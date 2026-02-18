import { NextResponse, type NextRequest } from "next/server"

import { getCsrfTokenFromRequest, verifyCsrfToken } from "@/app/lib/csrf"
import prisma from "@/app/lib/prismadb"
import { pusherServer } from "@/app/lib/pusher"
import { getPusherConversationChannel, getPusherUserChannel } from "@/app/lib/pusher-channels"
import getCurrentUser from "@/app/actions/getCurrentUser"

interface IParams {
  conversationId?: string
}

export async function POST(request: NextRequest, { params }: { params: Promise<IParams> }) {
  try {
    // CSRF Protection
    const headerToken = request.headers.get("X-CSRF-Token")
    const cookieToken = getCsrfTokenFromRequest(request)

    if (!verifyCsrfToken(headerToken, cookieToken)) {
      return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 })
    }

    const currentUser = await getCurrentUser()
    const { conversationId } = await params

    if (!currentUser?.id || !currentUser?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Find existing conversation and verify user is a participant
    const conversation = await prisma.conversation.findFirst({
      where: {
        id: conversationId,
        users: {
          some: {
            id: currentUser.id,
          },
        },
      },
      select: {
        id: true,
        messages: {
          select: {
            id: true,
            seen: {
              select: { id: true },
            },
          },
        },
      },
    })

    if (!conversation) {
      return NextResponse.json(
        { error: "Conversation not found or not authorized" },
        { status: 404 }
      )
    }

    // Find last message
    const lastMessage = conversation.messages[conversation.messages.length - 1]

    if (!lastMessage) {
      return NextResponse.json(conversation)
    }

    // Update seen of last message
    const updatedMessage = await prisma.message.update({
      where: {
        id: lastMessage.id,
      },
      include: {
        sender: true,
        seen: true,
      },
      data: {
        seen: {
          connect: {
            id: currentUser.id,
          },
        },
      },
    })

    // Update all connections with new seen
    await pusherServer.trigger(getPusherUserChannel(currentUser.id), "conversation:update", {
      id: conversationId,
      messages: [updatedMessage],
    })

    // If user has already seen the message, no need to go further
    if (lastMessage.seen.some((user: { id: string }) => user.id === currentUser.id)) {
      return NextResponse.json(conversation)
    }

    // Update last message seen
    await pusherServer.trigger(
      getPusherConversationChannel(conversationId!),
      "message:update",
      updatedMessage
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("CONVERSATION_SEEN_ERROR:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
