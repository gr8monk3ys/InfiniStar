import type { Metadata } from "next"

import getConversationById from "@/app/actions/getConversationById"
import getMessages from "@/app/actions/getMessages"
import EmptyState from "@/app/components/EmptyState"

import Body from "./components/Body"
import Form from "./components/Form"
import Header from "./components/Header"

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
        <Header conversation={{ ...conversation, messages }} />
        <Body initialMessages={messages} />
        <Form isAI={conversation.isAI || false} />
      </div>
    </div>
  )
}
