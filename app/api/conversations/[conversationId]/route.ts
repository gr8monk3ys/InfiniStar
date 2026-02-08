import { NextResponse, type NextRequest } from "next/server"

import { verifyCsrfToken } from "@/app/lib/csrf"
import prisma from "@/app/lib/prismadb"
import { pusherServer } from "@/app/lib/pusher"
import getCurrentUser from "@/app/actions/getCurrentUser"

interface IParams {
  conversationId?: string
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<IParams> }) {
  try {
    // CSRF Protection
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
      return new NextResponse("Invalid ID", { status: 400 })
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

    existingConversation.users.forEach((user: { email?: string | null }) => {
      if (user.email) {
        pusherServer.trigger(user.email, "conversation:remove", existingConversation)
      }
    })

    return NextResponse.json(deletedConversation)
  } catch (error) {
    return NextResponse.json(null)
  }
}
