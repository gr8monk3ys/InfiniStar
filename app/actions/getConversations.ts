import { MESSAGE_INCLUDE_FLAT, PARTICIPANT_SELECT } from "@/app/lib/conversation-select"
import { dbLogger } from "@/app/lib/logger"
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
      take: 100,
      where: {
        users: {
          some: {
            id: currentUser.id,
          },
        },
      },
      include: {
        users: { select: PARTICIPANT_SELECT },
        // Include tags that belong to the current user
        tags: {
          where: {
            userId: currentUser.id,
          },
        },
        // Only fetch the last message for performance
        messages: {
          include: MESSAGE_INCLUDE_FLAT,
          orderBy: {
            createdAt: "desc",
          },
          take: 1,
        },
      },
    })

    return conversations
  } catch (error) {
    dbLogger.error({ err: error }, "Failed to fetch conversations")
    return []
  }
}

export default getConversations
