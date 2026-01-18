"use client"

import { useCallback, useRef, useState } from "react"

interface StreamChunk {
  type: "chunk" | "done" | "error"
  content?: string
  messageId?: string
  error?: string
}

interface UseAiChatStreamOptions {
  conversationId: string
  csrfToken: string | null
  onChunk?: (chunk: string) => void
  onComplete?: (messageId: string) => void
  onError?: (error: string) => void
}

/**
 * Hook to handle streaming AI chat responses
 *
 * @param options - Configuration options
 * @returns Object with streaming state and send function
 *
 * @example
 * const { sendMessage, streamingContent, isStreaming, error } = useAiChatStream({
 *   conversationId,
 *   csrfToken,
 *   onComplete: (messageId) => console.log('Done:', messageId)
 * });
 *
 * await sendMessage('Hello, AI!');
 */
export function useAiChatStream(options: UseAiChatStreamOptions) {
  const { conversationId, csrfToken, onChunk, onComplete, onError } = options

  const [isStreaming, setIsStreaming] = useState(false)
  const [streamingContent, setStreamingContent] = useState("")
  const [error, setError] = useState<string | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  const sendMessage = useCallback(
    async (message: string) => {
      if (!csrfToken) {
        const err = "CSRF token not available"
        setError(err)
        onError?.(err)
        return
      }

      // Reset state
      setIsStreaming(true)
      setStreamingContent("")
      setError(null)

      // Create abort controller for cancellation
      abortControllerRef.current = new AbortController()

      try {
        const response = await fetch("/api/ai/chat-stream", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-CSRF-Token": csrfToken,
          },
          body: JSON.stringify({
            message,
            conversationId,
          }),
          signal: abortControllerRef.current.signal,
        })

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          throw new Error(errorData.error || `HTTP error! status: ${response.status}`)
        }

        if (!response.body) {
          throw new Error("No response body")
        }

        // Read the stream
        const reader = response.body.getReader()
        const decoder = new TextDecoder()

        let buffer = ""

        while (true) {
          const { done, value } = await reader.read()

          if (done) {
            break
          }

          // Decode the chunk
          buffer += decoder.decode(value, { stream: true })

          // Process complete SSE messages
          const lines = buffer.split("\n\n")
          buffer = lines.pop() || "" // Keep incomplete message in buffer

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              const data = line.slice(6)

              try {
                const parsed: StreamChunk = JSON.parse(data)

                if (parsed.type === "chunk" && parsed.content) {
                  setStreamingContent((prev) => prev + parsed.content)
                  onChunk?.(parsed.content)
                } else if (parsed.type === "done" && parsed.messageId) {
                  onComplete?.(parsed.messageId)
                } else if (parsed.type === "error") {
                  const errMsg = parsed.error || "Streaming error"
                  setError(errMsg)
                  onError?.(errMsg)
                }
              } catch (parseError) {
                console.error("Failed to parse SSE data:", data, parseError)
              }
            }
          }
        }
      } catch (err) {
        if (err instanceof Error) {
          if (err.name === "AbortError") {
            console.log("Stream aborted")
          } else {
            console.error("Streaming error:", err)
            setError(err.message)
            onError?.(err.message)
          }
        }
      } finally {
        setIsStreaming(false)
        abortControllerRef.current = null
      }
    },
    [conversationId, csrfToken, onChunk, onComplete, onError]
  )

  const cancelStream = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      setIsStreaming(false)
    }
  }, [])

  const resetStream = useCallback(() => {
    setStreamingContent("")
    setError(null)
  }, [])

  return {
    sendMessage,
    streamingContent,
    isStreaming,
    error,
    cancelStream,
    resetStream,
  }
}
