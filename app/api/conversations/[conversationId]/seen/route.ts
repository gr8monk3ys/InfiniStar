import { NextResponse, type NextRequest } from "next/server"

import { verifyCsrfToken } from "@/app/lib/csrf"
import prisma from "@/app/lib/prismadb"
import { pusherServer } from "@/app/lib/pusher"
import getCurrentUser from "@/app/actions/getCurrentUser"

interface IParams {
  conversationId?: string
}

export async function POST(request: NextRequest, { params }: { params: Promise<IParams> }) {
  try {
    // CSRF Protection
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
        userIds: {
          has: currentUser.id,
        },
      },
      include: {
        messages: {
          include: {
            seen: true,
          },
        },
        users: true,
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
    await pusherServer.trigger(currentUser.email, "conversation:update", {
      id: conversationId,
      messages: [updatedMessage],
    })

    // If user has already seen the message, no need to go further
    if (lastMessage.seenIds.indexOf(currentUser.id) !== -1) {
      return NextResponse.json(conversation)
    }

    // Update last message seen
    await pusherServer.trigger(conversationId!, "message:update", updatedMessage)

    return new NextResponse("Success")
  } catch (error) {
    return new NextResponse("Error", { status: 500 })
  }
}
