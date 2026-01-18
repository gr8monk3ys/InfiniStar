import prisma from "@/app/lib/prismadb"
import { type FullConversationType } from "@/app/types"

import getCurrentUser from "./getCurrentUser"

const getConversations = async (): Promise<FullConversationType[]> => {
  const currentUser = await getCurrentUser()

  if (!currentUser?.id) {
    return []
  }

  try {
    const conversations = await prisma.conversation.findMany({
      orderBy: {
        lastMessageAt: "desc",
      },
      where: {
        userIds: {
          has: currentUser.id,
        },
      },
      include: {
        users: true,
        // Only fetch the last message for performance
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

    return conversations
  } catch (error) {
    console.error("GET_CONVERSATIONS_ERROR:", error)
    return []
  }
}

export default getConversations
