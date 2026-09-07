import { MESSAGE_INCLUDE } from "@/app/lib/conversation-select"
import { dbLogger } from "@/app/lib/logger"
import prisma from "@/app/lib/prismadb"
import { type FullMessageType } from "@/app/types"

interface GetMessagesOptions {
  limit?: number
  cursor?: string
}

/**
 * A page of a conversation's messages, **oldest first**.
 *
 * The ordering is stated here because it is not obvious from the query: the
 * newest `limit` messages are selected by ordering descending, then reversed for
 * display. Four reads in this codebase order this same field, and they do not
 * agree with each other, so each one says which end it means.
 *
 * A database failure throws rather than returning `[]`, because an empty
 * conversation and an unreachable database are not the same thing and the
 * caller cannot tell them apart from the return value.
 */
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
      include: MESSAGE_INCLUDE,
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
    dbLogger.error({ err: error, conversationId }, "GET_MESSAGES_ERROR")
    throw error
  }
}

export default getMessages
