import prisma from "@/app/lib/prismadb"
import { getPusherConversationChannel, getPusherUserChannel } from "@/app/lib/pusher-channels"
import { pusherServer } from "@/app/lib/pusher-server"

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
    include: {
      sender: true,
      seen: true,
    },
    data: {
      seen: {
        connect: {
          id: currentUserId,
        },
      },
    },
  })

  await pusherServer.trigger(getPusherUserChannel(currentUserId), "conversation:update", {
    id: conversationId,
    messages: [updatedMessage],
  })

  await pusherServer.trigger(
    getPusherConversationChannel(conversationId),
    "message:update",
    updatedMessage
  )

  return { foundConversation: true, updated: true }
}
