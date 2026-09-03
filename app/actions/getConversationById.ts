import { PARTICIPANT_SELECT } from "@/app/lib/conversation-select"
import prisma from "@/app/lib/prismadb"

import getCurrentUser from "./getCurrentUser"

const getConversationById = async (conversationId: string) => {
  try {
    const currentUser = await getCurrentUser()

    if (!currentUser?.email) {
      return null
    }

    const conversation = await prisma.conversation.findUnique({
      where: {
        id: conversationId,
      },
      include: {
        users: { select: PARTICIPANT_SELECT },
        // Include tags that belong to the current user
        tags: {
          where: {
            userId: currentUser.id,
          },
        },
        character: true,
        persona: true,
      },
    })

    return conversation
  } catch {
    return null
  }
}

export default getConversationById
