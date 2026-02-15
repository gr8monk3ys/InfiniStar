"use client"

import { useCallback, useRef, useState } from "react"

interface StreamChunk {
  type: "chunk" | "done" | "error"
  content?: string
  messageId?: string
  error?: string
}

interface UseAiRegenerateOptions {
  csrfToken: string | null
  onChunk?: (chunk: string) => void
  onComplete?: (messageId: string) => void
  onError?: (error: string) => void
}

/**
 * Hook to handle AI response regeneration with streaming
 *
 * @param options - Configuration options
 * @returns Object with regeneration state and regenerate function
 *
 * @example
 * const { regenerate, isRegenerating, error } = useAiRegenerate({
 *   csrfToken,
 *   onComplete: (newId, deletedId) => console.log('Regenerated:', newId)
 * });
 *
 * await regenerate('message-id-123');
 */
export function useAiRegenerate(options: UseAiRegenerateOptions) {
  const { csrfToken, onChunk, onComplete, onError } = options

  const [isRegenerating, setIsRegenerating] = useState(false)
  const [regeneratingMessageId, setRegeneratingMessageId] = useState<string | null>(null)
  const [streamingContent, setStreamingContent] = useState("")
  const [error, setError] = useState<string | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  const regenerate = useCallback(
    async (messageId: string) => {
      if (!csrfToken) {
        const err = "CSRF token not available"
        setError(err)
        onError?.(err)
        return
      }

      // Reset state
      setIsRegenerating(true)
      setRegeneratingMessageId(messageId)
      setStreamingContent("")
      setError(null)

      // Create abort controller for cancellation
      abortControllerRef.current = new AbortController()

      try {
        const response = await fetch("/api/ai/regenerate", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-CSRF-Token": csrfToken,
          },
          body: JSON.stringify({ messageId }),
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
                  const errMsg = parsed.error || "Regeneration error"
                  setError(errMsg)
                  onError?.(errMsg)
                }
              } catch {
                // Silent failure for malformed SSE data - expected during stream processing
              }
            }
          }
        }
      } catch (err) {
        if (err instanceof Error) {
          if (err.name !== "AbortError") {
            // Only report non-abort errors to the UI
            setError(err.message)
            onError?.(err.message)
          }
          // Abort errors are expected when user cancels - silently ignore
        }
      } finally {
        setIsRegenerating(false)
        setRegeneratingMessageId(null)
        abortControllerRef.current = null
      }
    },
    [csrfToken, onChunk, onComplete, onError]
  )

  const cancelRegeneration = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      setIsRegenerating(false)
      setRegeneratingMessageId(null)
    }
  }, [])

  const resetState = useCallback(() => {
    setStreamingContent("")
    setError(null)
  }, [])

  return {
    regenerate,
    isRegenerating,
    regeneratingMessageId,
    streamingContent,
    error,
    cancelRegeneration,
    resetState,
  }
}
