import { publishMessageSeen } from "@/app/lib/conversation-events"
import { MESSAGE_INCLUDE } from "@/app/lib/conversation-select"
import prisma from "@/app/lib/prismadb"

export async function markConversationSeenByUserId({
  conversationId,
  currentUserId,
}: {
  conversationId: string
  currentUserId: string
}) {
  const conversation = await prisma.conversation.findFirst({
    where: {
      id: conversationId,
      users: {
        some: {
          id: currentUserId,
        },
      },
    },
    select: { id: true },
  })

  if (!conversation) {
    return { foundConversation: false, updated: false }
  }

  const lastMessage = await prisma.message.findFirst({
    where: { conversationId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      seen: { select: { id: true } },
    },
  })

  if (!lastMessage) {
    return { foundConversation: true, updated: false }
  }

  if (lastMessage.seen.some((user) => user.id === currentUserId)) {
    return { foundConversation: true, updated: false }
  }

  const updatedMessage = await prisma.message.update({
    where: {
      id: lastMessage.id,
    },
    include: MESSAGE_INCLUDE,
    data: {
      seen: {
        connect: {
          id: currentUserId,
        },
      },
    },
  })

  await publishMessageSeen({
    conversationId,
    message: updatedMessage,
    viewerId: currentUserId,
  })

  return { foundConversation: true, updated: true }
}
