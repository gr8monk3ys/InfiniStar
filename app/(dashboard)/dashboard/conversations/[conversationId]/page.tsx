import type { Metadata } from "next"

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
  const conversation = await getConversationById(conversationId)
  const messages = await getMessages(conversationId)
  const currentUser = await getCurrentUser()

  if (!conversation) {
    return (
      <div className="h-full lg:pl-80">
        <div className="flex h-full flex-col">
          <EmptyState />
        </div>
      </div>
    )
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
