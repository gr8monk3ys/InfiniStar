"use client"

import { useCallback, useRef, useState } from "react"

interface TokenUsage {
  inputTokens: number
  outputTokens: number
  totalTokens: number
}

interface StreamChunk {
  type: "chunk" | "done" | "error"
  content?: string
  messageId?: string
  error?: string
  usage?: TokenUsage
}

interface UseAiChatStreamOptions {
  conversationId: string
  csrfToken: string | null
  onChunk?: (chunk: string) => void
  onComplete?: (messageId: string, usage?: TokenUsage) => void
  onError?: (error: string) => void
}

interface SendAiMessageInput {
  message?: string
  image?: string
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
 * await sendMessage({ message: "Hello, AI!" });
 */
export function useAiChatStream(options: UseAiChatStreamOptions) {
  const { conversationId, csrfToken, onChunk, onComplete, onError } = options

  const [isStreaming, setIsStreaming] = useState(false)
  const [streamingContent, setStreamingContent] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [lastUsage, setLastUsage] = useState<TokenUsage | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  const sendMessage = useCallback(
    async (input: SendAiMessageInput): Promise<boolean> => {
      if (!csrfToken) {
        const err = "CSRF token not available"
        setError(err)
        onError?.(err)
        return false
      }

      // Reset state
      setIsStreaming(true)
      setStreamingContent("")
      setError(null)
      let streamErrored = false

      // Create abort controller for cancellation
      abortControllerRef.current = new AbortController()

      try {
        const trimmedMessage = input.message?.trim() || ""

        const response = await fetch("/api/ai/chat-stream", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-CSRF-Token": csrfToken,
          },
          body: JSON.stringify({
            message: trimmedMessage || undefined,
            image: input.image || undefined,
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
                  if (parsed.usage) {
                    setLastUsage(parsed.usage)
                  }
                  onComplete?.(parsed.messageId, parsed.usage)
                } else if (parsed.type === "error") {
                  const errMsg = parsed.error || "Streaming error"
                  setError(errMsg)
                  onError?.(errMsg)
                  streamErrored = true
                }
              } catch {
                // Silent failure for malformed SSE data - expected during stream processing
              }
            }
          }
        }
        return !streamErrored
      } catch (err) {
        if (err instanceof Error) {
          if (err.name !== "AbortError") {
            // Only report non-abort errors to the UI
            setError(err.message)
            onError?.(err.message)
          }
          // Abort errors are expected when user cancels - silently ignore
        }
        return false
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
    setLastUsage(null)
  }, [])

  return {
    sendMessage,
    streamingContent,
    isStreaming,
    error,
    lastUsage,
    cancelStream,
    resetStream,
  }
}

// Export type for use in other components
export type { TokenUsage }
