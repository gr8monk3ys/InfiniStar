"use client"

import { useEffect, useRef, useState } from "react"
import axios from "axios"

import { pusherClient } from "@/app/lib/pusher"
import useConversation from "@/app/(dashboard)/dashboard/hooks/useConversation"
import { type FullMessageType } from "@/app/types"

import MessageBox from "./MessageBox"

interface BodyProps {
  initialMessages: FullMessageType[]
}

const Body: React.FC<BodyProps> = ({ initialMessages = [] }) => {
  const bottomRef = useRef<HTMLDivElement>(null)
  const [messages, setMessages] = useState(initialMessages)

  const { conversationId } = useConversation()

  useEffect(() => {
    axios.post(`/api/conversations/${conversationId}/seen`)
  }, [conversationId])

  useEffect(() => {
    pusherClient.subscribe(conversationId)
    bottomRef?.current?.scrollIntoView()

    const messageHandler = (message: FullMessageType) => {
      axios.post(`/api/conversations/${conversationId}/seen`)

      setMessages((current) => {
        // Use native array method instead of lodash find
        if (current.some((m) => m.id === message.id)) {
          return current
        }

        return [...current, message]
      })

      bottomRef?.current?.scrollIntoView()
    }

    const updateMessageHandler = (newMessage: FullMessageType) => {
      setMessages((current) =>
        current.map((currentMessage) => {
          if (currentMessage.id === newMessage.id) {
            return newMessage
          }

          return currentMessage
        })
      )
    }

    const deleteMessageHandler = (deletedMessage: FullMessageType) => {
      setMessages((current) =>
        current.map((currentMessage) => {
          if (currentMessage.id === deletedMessage.id) {
            return deletedMessage
          }

          return currentMessage
        })
      )
    }

    const reactionHandler = (reactedMessage: FullMessageType) => {
      setMessages((current) =>
        current.map((currentMessage) => {
          if (currentMessage.id === reactedMessage.id) {
            return reactedMessage
          }

          return currentMessage
        })
      )
    }

    pusherClient.bind("messages:new", messageHandler)
    pusherClient.bind("message:update", updateMessageHandler)
    pusherClient.bind("message:delete", deleteMessageHandler)
    pusherClient.bind("message:reaction", reactionHandler)

    return () => {
      pusherClient.unsubscribe(conversationId)
      pusherClient.unbind("messages:new", messageHandler)
      pusherClient.unbind("message:update", updateMessageHandler)
      pusherClient.unbind("message:delete", deleteMessageHandler)
      pusherClient.unbind("message:reaction", reactionHandler)
    }
  }, [conversationId])

  return (
    <div className="flex-1 overflow-y-auto">
      {messages.map((message, i) => (
        <MessageBox isLast={i === messages.length - 1} key={message.id} data={message} />
      ))}
      <div className="pt-24" ref={bottomRef} />
    </div>
  )
}

export default Body
