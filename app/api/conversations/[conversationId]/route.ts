import { NextResponse, type NextRequest } from "next/server"

import { getCsrfTokenFromRequest, verifyCsrfToken } from "@/app/lib/csrf"
import prisma from "@/app/lib/prismadb"
import { pusherServer } from "@/app/lib/pusher"
import { getPusherUserChannel } from "@/app/lib/pusher-channels"
import getCurrentUser from "@/app/actions/getCurrentUser"

interface IParams {
  conversationId?: string
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<IParams> }) {
  try {
    // CSRF Protection
    const headerToken = request.headers.get("X-CSRF-Token")
    const cookieToken = getCsrfTokenFromRequest(request)

    if (!verifyCsrfToken(headerToken, cookieToken)) {
      return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 })
    }

    const { conversationId } = await params
    const currentUser = await getCurrentUser()

    if (!currentUser?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const existingConversation = await prisma.conversation.findUnique({
      where: {
        id: conversationId,
      },
      include: {
        users: true,
      },
    })

    if (!existingConversation) {
      return NextResponse.json({ error: "Invalid conversation ID" }, { status: 400 })
    }

    const deletedConversation = await prisma.conversation.deleteMany({
      where: {
        id: conversationId,
        users: {
          some: {
            id: currentUser.id,
          },
        },
      },
    })

    existingConversation.users.forEach((user: { id: string }) => {
      pusherServer.trigger(
        getPusherUserChannel(user.id),
        "conversation:remove",
        existingConversation
      )
    })

    return NextResponse.json(deletedConversation)
  } catch (error) {
    console.error("CONVERSATION_DELETE_ERROR:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
