import { type Character, type Conversation, type Tag, type UserPersona } from "@prisma/client"

import { PARTICIPANT_SELECT } from "@/app/lib/conversation-select"
import { dbLogger } from "@/app/lib/logger"
import prisma from "@/app/lib/prismadb"
import { type UserSummary } from "@/app/types"

import getCurrentUser from "./getCurrentUser"

export type ConversationDetail = Conversation & {
  users: UserSummary[]
  tags: Tag[]
  character: Character | null
  persona: UserPersona | null
}

/**
 * One conversation, with the participants, the viewer's tags, and the character
 * and persona it is being played with.
 *
 * `null` means the conversation does not exist or the viewer is not signed in —
 * and only that. A database failure throws, and the dashboard's error boundary
 * renders it as an error.
 *
 * That distinction is the point of this function's shape. It used to close with
 * a bare `catch { return null }` and no logging, so an outage was indistinguishable
 * from a missing row and the page rendered `<EmptyState />` — a chatter was told
 * their conversation did not exist while the database was down, and nothing was
 * logged.
 */
const getConversationById = async (conversationId: string): Promise<ConversationDetail | null> => {
  const currentUser = await getCurrentUser()

  if (!currentUser?.id) {
    return null
  }

  try {
    return await prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        users: { select: PARTICIPANT_SELECT },
        // Only the viewer's own tags.
        tags: { where: { userId: currentUser.id } },
        character: true,
        persona: true,
      },
    })
  } catch (error) {
    dbLogger.error({ err: error, conversationId }, "GET_CONVERSATION_BY_ID_ERROR")
    throw error
  }
}

export default getConversationById
