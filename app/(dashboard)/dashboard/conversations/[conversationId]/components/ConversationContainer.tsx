"use client"

import React, { useCallback, useEffect, useEffectEvent, useReducer, useRef } from "react"
import axios from "axios"
import toast from "react-hot-toast"

import { pusherClient } from "@/app/lib/pusher"
import { getPusherConversationChannel } from "@/app/lib/pusher-channels"
import useConversation from "@/app/(dashboard)/dashboard/hooks/useConversation"
import { useAiRegenerate } from "@/app/hooks/useAiRegenerate"
import { useCsrfToken } from "@/app/hooks/useCsrfToken"
import { useTypingIndicator } from "@/app/hooks/useTypingIndicator"
import { type FullMessageType } from "@/app/types"

import Body from "./Body"
import Form from "./Form"
import TypingIndicator from "./TypingIndicator"

interface ConversationContainerProps {
  initialMessages: FullMessageType[]
  isAI: boolean
  characterName?: string | null
  characterAvatar?: string | null
  currentUserId: string | null
}

type MessageAction =
  | { type: "append_if_missing"; message: FullMessageType }
  | { type: "replace_message"; message: FullMessageType }

function messagesReducer(state: FullMessageType[], action: MessageAction): FullMessageType[] {
  switch (action.type) {
    case "append_if_missing":
      if (state.some((message) => message.id === action.message.id)) {
        return state
      }
      return [...state, action.message]
    case "replace_message":
      return state.map((message) => (message.id === action.message.id ? action.message : message))
    default:
      return state
  }
}

/**
 * ConversationContainer - Client component wrapper for conversation view
 *
 * Manages typing indicator state and coordinates between Body and Form components.
 * Displays typing indicators for both human users and AI responses.
 * Also manages messages state for AI suggestions feature.
 */
const ConversationContainer: React.FC<ConversationContainerProps> = ({
  initialMessages,
  isAI,
  characterName,
  characterAvatar,
  currentUserId: currentUserIdProp,
}) => {
  const { conversationId } = useConversation()
  const currentUserId = currentUserIdProp ?? undefined
  const { token: csrfToken } = useCsrfToken()
  const bottomRef = useRef<HTMLDivElement | null>(null)

  // Keep a ref to the current CSRF token so Pusher handlers always read the latest
  // value without needing to be re-registered when the token resolves from null.
  const csrfTokenRef = useRef(csrfToken)
  useEffect(() => {
    csrfTokenRef.current = csrfToken
  }, [csrfToken])

  // Debounce ref to avoid calling /seen on every streaming token
  const seenDebounceRef = useRef<NodeJS.Timeout | null>(null)

  // Lift messages state to share with Form for suggestions
  const [messages, dispatchMessages] = useReducer(messagesReducer, initialMessages)

  // Subscribe to typing events for this conversation with AI typing state
  const { typingUsers, isAITyping, setAITyping } = useTypingIndicator({
    conversationId,
    currentUserId,
  })

  // Handle AI streaming state changes from Form
  const handleAIStreamingChange = useCallback(
    (isStreaming: boolean) => {
      setAITyping(isStreaming)
    },
    [setAITyping]
  )

  // Set up regeneration hook for AI conversations
  const { regenerate, isRegenerating, regeneratingMessageId, streamingContent } = useAiRegenerate({
    csrfToken,
    onComplete: () => {
      toast.success("AI response regenerated")
    },
    onError: (error) => {
      toast.error(`Regeneration failed: ${error}`)
    },
  })

  // Handler for regenerate button click
  const handleRegenerate = useCallback(
    (messageId: string) => {
      if (isRegenerating) {
        toast.error("Already regenerating a response")
        return
      }
      regenerate(messageId)
    },
    [regenerate, isRegenerating]
  )

  const markConversationSeen = useEffectEvent(() => {
    if (!csrfTokenRef.current) return

    axios.post(
      `/api/conversations/${conversationId}/seen`,
      {},
      { headers: { "X-CSRF-Token": csrfTokenRef.current } }
    )
  })

  // Subscribe to Pusher events for real-time updates
  useEffect(() => {
    const channelName = getPusherConversationChannel(conversationId)

    const channel = pusherClient.subscribe(channelName)
    bottomRef?.current?.scrollIntoView()

    const messageHandler = (message: FullMessageType) => {
      // Debounce the /seen call — avoids a network request per streaming token
      if (seenDebounceRef.current) clearTimeout(seenDebounceRef.current)
      seenDebounceRef.current = setTimeout(() => {
        markConversationSeen()
      }, 1000)

      dispatchMessages({ type: "append_if_missing", message })

      bottomRef?.current?.scrollIntoView()
    }

    const updateMessageHandler = (newMessage: FullMessageType) => {
      dispatchMessages({ type: "replace_message", message: newMessage })
    }

    const deleteMessageHandler = (deletedMessage: FullMessageType) => {
      dispatchMessages({ type: "replace_message", message: deletedMessage })
    }

    const reactionHandler = (reactedMessage: FullMessageType) => {
      dispatchMessages({ type: "replace_message", message: reactedMessage })
    }

    channel.bind("messages:new", messageHandler)
    channel.bind("message:update", updateMessageHandler)
    channel.bind("message:delete", deleteMessageHandler)
    channel.bind("message:reaction", reactionHandler)

    return () => {
      channel.unbind("messages:new", messageHandler)
      channel.unbind("message:update", updateMessageHandler)
      channel.unbind("message:delete", deleteMessageHandler)
      channel.unbind("message:reaction", reactionHandler)
      pusherClient.unsubscribe(channelName)
      if (seenDebounceRef.current) {
        clearTimeout(seenDebounceRef.current)
      }
    }
    // csrfToken is intentionally excluded — it is read via csrfTokenRef so handlers
    // never go stale and the subscription is not torn down when the token resolves.
  }, [conversationId, markConversationSeen])

  return (
    <>
      <Body
        initialMessages={messages}
        isAI={isAI}
        characterName={characterName}
        characterAvatar={characterAvatar}
        csrfToken={csrfToken}
        currentUserId={currentUserIdProp}
        onRegenerate={isAI ? handleRegenerate : undefined}
        isRegenerating={isRegenerating}
        regeneratingMessageId={regeneratingMessageId}
        regeneratingContent={streamingContent}
        bottomRef={bottomRef}
      />

      {/* Typing indicator - displayed above the message input */}
      <TypingIndicator typingUsers={typingUsers} isAITyping={isAI && isAITyping} />

      <Form
        isAI={isAI}
        onAIStreamingChange={handleAIStreamingChange}
        messages={messages}
        currentUserId={currentUserIdProp}
      />
    </>
  )
}

export default ConversationContainer
