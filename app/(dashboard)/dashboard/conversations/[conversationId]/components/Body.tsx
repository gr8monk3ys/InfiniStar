"use client"

import { memo, useEffect, useRef, type RefObject } from "react"
import { useVirtualizer } from "@tanstack/react-virtual"

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
 * Uses @tanstack/react-virtual to virtualize the message list so only
 * visible messages are rendered, keeping performance stable for long
 * conversations.
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
}) {
  const parentRef = useRef<HTMLDivElement>(null)

  const virtualizer = useVirtualizer({
    count: initialMessages.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 80,
    overscan: 5,
  })

  // Scroll to the bottom whenever new messages arrive
  useEffect(() => {
    if (initialMessages.length === 0) return
    virtualizer.scrollToIndex(initialMessages.length - 1, { align: "end" })
  }, [initialMessages.length, virtualizer])

  return (
    <div ref={parentRef} className="flex-1 overflow-y-auto">
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: "100%",
          position: "relative",
        }}
      >
        {virtualizer.getVirtualItems().map((virtualItem) => {
          const message = initialMessages[virtualItem.index]
          return (
            <div
              key={virtualItem.key}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                transform: `translateY(${virtualItem.start}px)`,
              }}
            >
              <MessageBox
                key={message.id}
                data={message}
                isLast={virtualItem.index === initialMessages.length - 1}
                csrfToken={csrfToken}
                currentUserId={currentUserId}
                characterName={characterName}
                characterAvatar={characterAvatar}
                onRegenerate={isAI ? onRegenerate : undefined}
                isRegenerating={isRegenerating}
                regeneratingMessageId={regeneratingMessageId}
                regeneratingContent={regeneratingContent}
              />
            </div>
          )
        })}
      </div>
    </div>
  )
})

export default Body
