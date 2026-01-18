import prisma from "@/app/lib/prismadb"
import { type FullMessageType } from "@/app/types"

interface GetMessagesOptions {
  limit?: number
  cursor?: string
}

const getMessages = async (
  conversationId: string,
  options: GetMessagesOptions = {}
): Promise<FullMessageType[]> => {
  const { limit = 50, cursor } = options

  try {
    const messages = await prisma.message.findMany({
      where: {
        conversationId: conversationId,
      },
      include: {
        sender: true,
        seen: true,
        replyTo: {
          include: {
            sender: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      take: limit,
      ...(cursor && {
        skip: 1,
        cursor: {
          id: cursor,
        },
      }),
    })

    // Reverse to return in ascending order (oldest first)
    return messages.reverse()
  } catch (error) {
    console.error("GET_MESSAGES_ERROR:", error)
    return []
  }
}

export default getMessages
