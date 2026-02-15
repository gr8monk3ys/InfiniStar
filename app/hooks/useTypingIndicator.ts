"use client"

import { useCallback, useEffect, useRef, useState } from "react"

import { getClientCsrfToken } from "@/app/lib/csrf-client"
import { pusherClient } from "@/app/lib/pusher"
import { getPusherConversationChannel } from "@/app/lib/pusher-channels"

interface TypingUser {
  userId: string
  userName: string
  timeoutId: NodeJS.Timeout
}

interface TypingPayload {
  userId: string
  userName: string
  isTyping: boolean
}

interface UseTypingIndicatorOptions {
  conversationId: string
  currentUserId?: string
  /** Time in milliseconds before auto-clearing typing status (default: 3000ms) */
  timeoutMs?: number
  /** Initial AI typing state (optional) */
  initialAITyping?: boolean
}

interface UseTypingIndicatorReturn {
  /** Names of users currently typing (excluding current user) */
  typingUsers: string[]
  /** Whether AI is currently typing/generating a response */
  isAITyping: boolean
  /** Function to emit typing status to other users */
  emitTyping: (isTyping: boolean) => void
  /** Function to set AI typing state (for local state management) */
  setAITyping: (isTyping: boolean) => void
  /** Function to start AI typing (convenience wrapper) */
  startAITyping: () => void
  /** Function to stop AI typing (convenience wrapper) */
  stopAITyping: () => void
}

/**
 * Hook to manage typing indicators for a conversation
 *
 * Subscribes to Pusher typing events and manages auto-clear timeout.
 * Also provides AI typing state management for streaming responses.
 *
 * @example
 * const { typingUsers, isAITyping, emitTyping, setAITyping } = useTypingIndicator({
 *   conversationId,
 *   currentUserId: user.id,
 * });
 *
 * // For AI streaming:
 * setAITyping(true);  // When AI starts generating
 * setAITyping(false); // When AI finishes or errors
 */
export function useTypingIndicator(options: UseTypingIndicatorOptions): UseTypingIndicatorReturn {
  const { conversationId, currentUserId, timeoutMs = 3000, initialAITyping = false } = options

  const [typingUsersMap, setTypingUsersMap] = useState<Map<string, TypingUser>>(new Map())
  const [isAITyping, setIsAITyping] = useState(initialAITyping)
  const emitTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const lastEmitRef = useRef<boolean>(false)

  // Convert map to array of names for the component
  const typingUsers = Array.from(typingUsersMap.values()).map((user) => user.userName)

  // Handle incoming typing events
  useEffect(() => {
    if (!conversationId) return

    const handleTyping = (payload: TypingPayload) => {
      const { userId, userName, isTyping } = payload

      // Ignore typing events from the current user
      if (userId === currentUserId) return

      setTypingUsersMap((prev) => {
        const newMap = new Map(prev)

        if (isTyping) {
          // Clear existing timeout if user was already typing
          const existingUser = newMap.get(userId)
          if (existingUser) {
            clearTimeout(existingUser.timeoutId)
          }

          // Set new timeout to auto-clear typing status
          const timeoutId = setTimeout(() => {
            setTypingUsersMap((current) => {
              const updated = new Map(current)
              updated.delete(userId)
              return updated
            })
          }, timeoutMs)

          newMap.set(userId, { userId, userName, timeoutId })
        } else {
          // User stopped typing - clear immediately
          const existingUser = newMap.get(userId)
          if (existingUser) {
            clearTimeout(existingUser.timeoutId)
          }
          newMap.delete(userId)
        }

        return newMap
      })
    }

    // Subscribe to the conversation channel
    pusherClient.subscribe(getPusherConversationChannel(conversationId))
    pusherClient.bind("user:typing", handleTyping)

    return () => {
      // Cleanup: clear all timeouts and unsubscribe
      // Using setTypingUsersMap to access current state in cleanup
      setTypingUsersMap((current) => {
        current.forEach((user) => clearTimeout(user.timeoutId))
        return new Map()
      })
      pusherClient.unbind("user:typing", handleTyping)
      // Note: We don't unsubscribe from the channel here because
      // other components (Body.tsx) may also be subscribed to it
    }
  }, [conversationId, currentUserId, timeoutMs])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (emitTimeoutRef.current) {
        clearTimeout(emitTimeoutRef.current)
      }
    }
  }, [])

  // Function to emit typing status
  const emitTyping = useCallback(
    async (isTyping: boolean) => {
      // Debounce: don't emit if status hasn't changed
      if (lastEmitRef.current === isTyping) return
      lastEmitRef.current = isTyping

      // Clear any pending emit timeout
      if (emitTimeoutRef.current) {
        clearTimeout(emitTimeoutRef.current)
        emitTimeoutRef.current = null
      }

      try {
        const csrfToken = await getClientCsrfToken()
        if (!csrfToken) {
          console.warn("CSRF token not available for typing indicator")
          return
        }

        await fetch(`/api/conversations/${conversationId}/typing`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-CSRF-Token": csrfToken,
          },
          body: JSON.stringify({ isTyping }),
        })

        // Auto-clear typing status after timeout (in case user stops typing without clearing)
        if (isTyping) {
          emitTimeoutRef.current = setTimeout(() => {
            lastEmitRef.current = false
            fetch(`/api/conversations/${conversationId}/typing`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "X-CSRF-Token": csrfToken,
              },
              body: JSON.stringify({ isTyping: false }),
            }).catch(() => {
              // Silently ignore errors on auto-clear
            })
          }, timeoutMs)
        }
      } catch (error) {
        // Silently ignore typing indicator errors - not critical to chat functionality
        console.warn("Failed to emit typing indicator:", error)
      }
    },
    [conversationId, timeoutMs]
  )

  // AI typing state setters
  const setAITyping = useCallback((isTyping: boolean) => {
    setIsAITyping(isTyping)
  }, [])

  const startAITyping = useCallback(() => {
    setIsAITyping(true)
  }, [])

  const stopAITyping = useCallback(() => {
    setIsAITyping(false)
  }, [])

  return {
    typingUsers,
    isAITyping,
    emitTyping,
    setAITyping,
    startAITyping,
    stopAITyping,
  }
}
