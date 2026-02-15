"use client"

import { memo, type RefObject } from "react"

import { type FullMessageType } from "@/app/types"

import MessageBox from "./MessageBox"

interface BodyProps {
  initialMessages: FullMessageType[]
  isAI?: boolean
  characterName?: string | null
  characterAvatar?: string | null
  csrfToken?: string | null
  currentUserId?: string | null
  onRegenerate?: (messageId: string) => void
  isRegenerating?: boolean
  regeneratingMessageId?: string | null
  regeneratingContent?: string
  bottomRef?: RefObject<HTMLDivElement | null>
}

/**
 * Body component - Displays the conversation messages
 *
 * Messages state is now managed by ConversationContainer parent component
 * to enable sharing with Form for AI suggestions feature.
 *
 * Wrapped with React.memo to prevent unnecessary re-renders when parent state changes
 * but the message list hasn't changed.
 */
const Body: React.FC<BodyProps> = memo(function Body({
  initialMessages = [],
  isAI = false,
  characterName,
  characterAvatar,
  csrfToken,
  currentUserId,
  onRegenerate,
  isRegenerating = false,
  regeneratingMessageId,
  regeneratingContent,
  bottomRef,
}) {
  return (
    <div className="flex-1 overflow-y-auto">
      {initialMessages.map((message, i) => (
        <MessageBox
          isLast={i === initialMessages.length - 1}
          key={message.id}
          data={message}
          csrfToken={csrfToken}
          currentUserId={currentUserId}
          characterName={characterName}
          characterAvatar={characterAvatar}
          onRegenerate={isAI ? onRegenerate : undefined}
          isRegenerating={isRegenerating}
          regeneratingMessageId={regeneratingMessageId}
          regeneratingContent={regeneratingContent}
        />
      ))}
      <div className="pt-24" ref={bottomRef} />
    </div>
  )
})

export default Body
