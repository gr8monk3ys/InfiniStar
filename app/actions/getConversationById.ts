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
        users: true,
        // Include tags that belong to the current user
        tags: {
          where: {
            userId: currentUser.id,
          },
        },
        character: true,
      },
    })

    return conversation
  } catch {
    return null
  }
}

export default getConversationById
