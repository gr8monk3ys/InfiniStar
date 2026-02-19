"use client"

import { useEffect, useRef } from "react"
import { useRouter } from "next/navigation"

import { pusherClient } from "@/app/lib/pusher"
import { getPusherUserChannel } from "@/app/lib/pusher-channels"
import { type FullConversationType } from "@/app/types"

interface NotificationPreferences {
  browserNotifications: boolean
  notifyOnNewMessage: boolean
  notifyOnAIComplete: boolean
  mutedConversations: string[]
}

interface UsePusherConversationSyncParams {
  currentUserId: string | null
  items: FullConversationType[]
  setItems: React.Dispatch<React.SetStateAction<FullConversationType[]>>
  notificationPrefs: NotificationPreferences | null
}

/**
 * Subscribes to the user's Pusher channel and binds all conversation event
 * handlers. Cleans up on unmount. Side-effects only — returns nothing.
 *
 * Mirrors `items` and `notificationPrefs` into refs so event handlers always
 * read the latest values without needing to re-subscribe on every render.
 */
export function usePusherConversationSync({
  currentUserId,
  items,
  setItems,
  notificationPrefs,
}: UsePusherConversationSyncParams): void {
  const router = useRouter()

  // Keep refs in sync so event handlers always read the latest values
  const itemsRef = useRef<FullConversationType[]>(items)
  const notificationPrefsRef = useRef<NotificationPreferences | null>(notificationPrefs)
  const lastNotifiedMessageIdRef = useRef<Map<string, string>>(new Map())

  useEffect(() => {
    itemsRef.current = items
  }, [items])

  useEffect(() => {
    notificationPrefsRef.current = notificationPrefs
  }, [notificationPrefs])

  useEffect(() => {
    if (!currentUserId) {
      return
    }

    const userChannel = getPusherUserChannel(currentUserId)
    const channel = pusherClient.subscribe(userChannel)

    const updateHandler = (conversation: FullConversationType) => {
      const incomingMessage = conversation.messages?.[0]
      if (incomingMessage) {
        const existingConversation = itemsRef.current.find((c) => c.id === conversation.id)
        const previousMessageId = existingConversation?.messages?.[0]?.id || null
        const lastNotifiedId = lastNotifiedMessageIdRef.current.get(conversation.id) || null
        const shouldConsiderNew =
          incomingMessage.id !== previousMessageId && incomingMessage.id !== lastNotifiedId

        if (shouldConsiderNew) {
          lastNotifiedMessageIdRef.current.set(conversation.id, incomingMessage.id)

          const prefs = notificationPrefsRef.current
          if (
            prefs &&
            prefs.browserNotifications &&
            !prefs.mutedConversations.includes(conversation.id) &&
            typeof window !== "undefined" &&
            "Notification" in window &&
            Notification.permission === "granted" &&
            typeof document !== "undefined" &&
            document.hidden
          ) {
            const isAiMessage = Boolean(incomingMessage.isAI)
            const shouldNotifyForType = isAiMessage
              ? prefs.notifyOnAIComplete
              : prefs.notifyOnNewMessage
            const isOwnMessage = !isAiMessage && incomingMessage.senderId === currentUserId

            if (shouldNotifyForType && !isOwnMessage) {
              const titleFallback = isAiMessage ? "AI reply" : "New message"

              let title = existingConversation?.name || titleFallback
              if (
                !existingConversation?.name &&
                existingConversation &&
                !existingConversation.isGroup
              ) {
                const other = existingConversation.users?.find((u) => u.id !== currentUserId)
                title = other?.name || titleFallback
              }

              const preview = incomingMessage.image
                ? "Sent an image"
                : incomingMessage.body
                  ? incomingMessage.body.slice(0, 160)
                  : "New message"

              const prefix = isAiMessage
                ? "AI: "
                : incomingMessage.sender?.name
                  ? `${incomingMessage.sender.name}: `
                  : ""

              try {
                const notification = new Notification(title, {
                  body: `${prefix}${preview}`,
                  icon: "/icon-192.png",
                  tag: conversation.id,
                })

                notification.onclick = () => {
                  try {
                    window.focus()
                  } catch {
                    // ignore
                  }
                  router.push(`/dashboard/conversations/${conversation.id}`)
                  notification.close()
                }
              } catch {
                // Ignore notification errors (permissions, unsupported, etc.)
              }
            }
          }
        }
      }

      setItems((current) =>
        current.map((currentConversation) => {
          if (currentConversation.id === conversation.id) {
            return {
              ...currentConversation,
              messages: conversation.messages,
            }
          }

          return currentConversation
        })
      )
    }

    const newHandler = (conversation: FullConversationType) => {
      setItems((current) => {
        if (current.some((c) => c.id === conversation.id)) {
          return current
        }

        return [conversation, ...current]
      })
    }

    const removeHandler = (conversation: FullConversationType) => {
      setItems((current) => {
        return [...current.filter((convo) => convo.id !== conversation.id)]
      })
    }

    // archive and unarchive carry the same payload shape — one handler covers both events
    const archiveHandler = (conversation: FullConversationType) => {
      setItems((current) =>
        current.map((currentConversation) =>
          currentConversation.id === conversation.id
            ? {
                ...currentConversation,
                archivedBy: conversation.archivedBy,
                archivedAt: conversation.archivedAt,
              }
            : currentConversation
        )
      )
    }

    // pin and unpin carry the same payload shape — one handler covers both events
    const pinHandler = (conversation: FullConversationType) => {
      setItems((current) =>
        current.map((currentConversation) =>
          currentConversation.id === conversation.id
            ? {
                ...currentConversation,
                pinnedBy: conversation.pinnedBy,
                pinnedAt: conversation.pinnedAt,
              }
            : currentConversation
        )
      )
    }

    // mute and unmute carry the same payload shape — one handler covers both events
    const muteHandler = (conversation: FullConversationType) => {
      setItems((current) =>
        current.map((currentConversation) =>
          currentConversation.id === conversation.id
            ? {
                ...currentConversation,
                mutedBy: conversation.mutedBy,
                mutedAt: conversation.mutedAt,
              }
            : currentConversation
        )
      )
    }

    channel.bind("conversation:update", updateHandler)
    channel.bind("conversation:new", newHandler)
    channel.bind("conversation:remove", removeHandler)
    channel.bind("conversation:archive", archiveHandler)
    channel.bind("conversation:unarchive", archiveHandler)
    channel.bind("conversation:pin", pinHandler)
    channel.bind("conversation:unpin", pinHandler)
    channel.bind("conversation:mute", muteHandler)
    channel.bind("conversation:unmute", muteHandler)

    return () => {
      channel.unbind("conversation:update", updateHandler)
      channel.unbind("conversation:new", newHandler)
      channel.unbind("conversation:remove", removeHandler)
      channel.unbind("conversation:archive", archiveHandler)
      channel.unbind("conversation:unarchive", archiveHandler)
      channel.unbind("conversation:pin", pinHandler)
      channel.unbind("conversation:unpin", pinHandler)
      channel.unbind("conversation:mute", muteHandler)
      channel.unbind("conversation:unmute", muteHandler)

      pusherClient.unsubscribe(userChannel)
    }
  }, [currentUserId, router, setItems])
}
