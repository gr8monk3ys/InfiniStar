import type { Metadata } from "next"
import { after } from "next/server"

import { markConversationSeenByUserId } from "@/app/lib/conversation-seen"
import getConversationById from "@/app/actions/getConversationById"
import getCurrentUser from "@/app/actions/getCurrentUser"
import getMessages from "@/app/actions/getMessages"
import EmptyState from "@/app/components/EmptyState"

import ConversationContainer from "./components/ConversationContainer"
import Header from "./components/Header"
import { TokenUsageWrapper } from "./components/TokenUsageWrapper"

export const metadata: Metadata = {
  title: "Chat",
  description: "Chat with others",
}

export default async function ChatPage({
  params,
}: {
  params: Promise<{ conversationId: string }>
}) {
  const { conversationId } = await params
  const [conversation, messages, currentUser] = await Promise.all([
    getConversationById(conversationId),
    getMessages(conversationId),
    getCurrentUser(),
  ])

  if (!conversation) {
    return (
      <div className="h-full lg:pl-80">
        <div className="flex h-full flex-col">
          <EmptyState />
        </div>
      </div>
    )
  }

  if (currentUser?.id) {
    after(async () => {
      await markConversationSeenByUserId({
        conversationId,
        currentUserId: currentUser.id,
      })
    })
  }

  return (
    <div className="h-full lg:pl-80">
      <div className="flex h-full flex-col">
        <Header
          conversation={{ ...conversation, messages }}
          currentUserId={currentUser?.id ?? null}
        />
        {conversation.isAI && <TokenUsageWrapper conversationId={conversationId} />}
        <ConversationContainer
          key={conversationId}
          initialMessages={messages}
          isAI={conversation.isAI || false}
          characterName={conversation.character?.name}
          characterAvatar={conversation.character?.avatarUrl}
          currentUserId={currentUser?.id ?? null}
        />
      </div>
    </div>
  )
}
