import prisma from "@/app/lib/prismadb"

/**
 * The characters this chatter already has a conversation with, most recent
 * first.
 *
 * PRODUCT.md's first principle is "relationships over sessions — every surface
 * should make it easy to return to an existing character, not just start a new
 * one". Explore did the opposite: it was a wall of strangers whether you had
 * been here for five minutes or five months, and the conversation you were
 * actually in the middle of was two navigations away.
 *
 * Scoped through `users: { some: { id } }` rather than by a passed-in filter,
 * so a conversation can only ever be listed for someone who is in it.
 */

export const RECENT_CHARACTER_CHAT_LIMIT = 6

export interface RecentCharacterChat {
  conversationId: string
  characterId: string
  name: string
  slug: string
  avatarUrl: string | null
  lastMessageAt: Date
  messageCount: number
}

export default async function getRecentCharacterChats(
  userId: string | undefined
): Promise<RecentCharacterChat[]> {
  if (!userId) return []

  const conversations = await prisma.conversation.findMany({
    where: {
      users: { some: { id: userId } },
      // A conversation with no character is a direct or group chat; this rail
      // is about characters, and the dashboard already lists the rest.
      character: { isNot: null },
    },
    orderBy: { lastMessageAt: "desc" },
    take: RECENT_CHARACTER_CHAT_LIMIT,
    select: {
      id: true,
      lastMessageAt: true,
      character: { select: { id: true, name: true, slug: true, avatarUrl: true } },
      _count: { select: { messages: true } },
    },
  })

  return conversations.flatMap((conversation) =>
    conversation.character
      ? [
          {
            conversationId: conversation.id,
            characterId: conversation.character.id,
            name: conversation.character.name,
            slug: conversation.character.slug,
            avatarUrl: conversation.character.avatarUrl,
            lastMessageAt: conversation.lastMessageAt,
            messageCount: conversation._count.messages,
          },
        ]
      : []
  )
}
