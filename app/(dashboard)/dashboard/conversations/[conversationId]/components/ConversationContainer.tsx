"use client"

import React, { useCallback, useEffect, useRef, useState } from "react"
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

  // Lift messages state to share with Form for suggestions
  const [messages, setMessages] = useState<FullMessageType[]>(initialMessages)

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
  const { regenerate, isRegenerating, regeneratingMessageId } = useAiRegenerate({
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

  // Mark messages as seen
  useEffect(() => {
    if (!csrfToken) return
    axios.post(
      `/api/conversations/${conversationId}/seen`,
      {},
      { headers: { "X-CSRF-Token": csrfToken } }
    )
  }, [conversationId, csrfToken])

  // Subscribe to Pusher events for real-time updates
  useEffect(() => {
    const channelName = getPusherConversationChannel(conversationId)

    pusherClient.subscribe(channelName)
    bottomRef?.current?.scrollIntoView()

    const messageHandler = (message: FullMessageType) => {
      if (csrfToken) {
        axios.post(
          `/api/conversations/${conversationId}/seen`,
          {},
          { headers: { "X-CSRF-Token": csrfToken } }
        )
      }

      setMessages((current) => {
        if (current.some((m) => m.id === message.id)) {
          return current
        }
        return [...current, message]
      })

      bottomRef?.current?.scrollIntoView()
    }

    const updateMessageHandler = (newMessage: FullMessageType) => {
      setMessages((current) =>
        current.map((currentMessage) =>
          currentMessage.id === newMessage.id ? newMessage : currentMessage
        )
      )
    }

    const deleteMessageHandler = (deletedMessage: FullMessageType) => {
      setMessages((current) =>
        current.map((currentMessage) =>
          currentMessage.id === deletedMessage.id ? deletedMessage : currentMessage
        )
      )
    }

    const reactionHandler = (reactedMessage: FullMessageType) => {
      setMessages((current) =>
        current.map((currentMessage) =>
          currentMessage.id === reactedMessage.id ? reactedMessage : currentMessage
        )
      )
    }

    pusherClient.bind("messages:new", messageHandler)
    pusherClient.bind("message:update", updateMessageHandler)
    pusherClient.bind("message:delete", deleteMessageHandler)
    pusherClient.bind("message:reaction", reactionHandler)

    return () => {
      pusherClient.unsubscribe(channelName)
      pusherClient.unbind("messages:new", messageHandler)
      pusherClient.unbind("message:update", updateMessageHandler)
      pusherClient.unbind("message:delete", deleteMessageHandler)
      pusherClient.unbind("message:reaction", reactionHandler)
    }
  }, [conversationId, csrfToken])

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
