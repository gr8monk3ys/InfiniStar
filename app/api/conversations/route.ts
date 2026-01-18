import { NextResponse, type NextRequest } from "next/server"
import { getServerSession } from "next-auth"

import { authOptions } from "@/app/lib/auth"
import { verifyCsrfToken } from "@/app/lib/csrf"
import prisma from "@/app/lib/prismadb"
import { pusherServer } from "@/app/lib/pusher"
import { sanitizePlainText } from "@/app/lib/sanitize"

export async function POST(request: NextRequest) {
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

    const session = await getServerSession(authOptions)
    const currentUser = session?.user
    const body = await request.json()
    const { userId, isGroup, members, name, isAI, aiModel } = body

    if (!currentUser?.id || !currentUser?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Sanitize conversation name if provided
    const sanitizedName = name ? sanitizePlainText(name) : null

    // Handle AI conversation creation
    if (isAI) {
      const newConversation = await prisma.conversation.create({
        data: {
          name: sanitizedName || "AI Assistant",
          isAI: true,
          aiModel: aiModel || "claude-3-5-sonnet-20241022",
          users: {
            connect: {
              id: currentUser.id,
            },
          },
        },
        include: {
          users: true,
          messages: {
            include: {
              sender: true,
              seen: true,
            },
          },
        },
      })

      // Trigger Pusher event for user
      if (currentUser.email) {
        pusherServer.trigger(currentUser.email, "conversation:new", newConversation)
      }

      return NextResponse.json(newConversation)
    }

    if (isGroup && (!members || members.length < 2)) {
      return new NextResponse("Invalid data", { status: 400 })
    }

    if (isGroup) {
      const newConversation = await prisma.conversation.create({
        data: {
          name: sanitizedName,
          isGroup: true,
          users: {
            connect: members.map((id: string) => ({
              id,
            })),
          },
        },
        include: {
          users: true,
          messages: {
            include: {
              sender: true,
              seen: true,
            },
          },
        },
      })

      // Trigger Pusher event for all users in the conversation
      newConversation.users.forEach((user) => {
        if (user.email) {
          pusherServer.trigger(user.email, "conversation:new", newConversation)
        }
      })

      return NextResponse.json(newConversation)
    }

    const existingConversations = await prisma.conversation.findMany({
      where: {
        OR: [
          {
            userIds: {
              equals: [currentUser.id, userId],
            },
          },
          {
            userIds: {
              equals: [userId, currentUser.id],
            },
          },
        ],
      },
    })

    const singleConversation = existingConversations[0]

    if (singleConversation) {
      return NextResponse.json(singleConversation)
    }

    const newConversation = await prisma.conversation.create({
      data: {
        users: {
          connect: [
            {
              id: currentUser.id,
            },
            {
              id: userId,
            },
          ],
        },
      },
      include: {
        users: true,
        messages: {
          include: {
            sender: true,
            seen: true,
          },
        },
      },
    })

    // Trigger Pusher event for all users in the conversation
    newConversation.users.forEach((user) => {
      if (user.email) {
        pusherServer.trigger(user.email, "conversation:new", newConversation)
      }
    })

    return NextResponse.json(newConversation)
  } catch (error) {
    return new NextResponse("Internal Error", { status: 500 })
  }
}
