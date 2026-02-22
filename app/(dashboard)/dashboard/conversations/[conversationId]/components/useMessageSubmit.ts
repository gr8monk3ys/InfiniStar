"use client"

import { useCallback } from "react"
import type { CloudinaryUploadWidgetResults } from "next-cloudinary"
import { useForm, type FieldValues, type SubmitHandler } from "react-hook-form"
import toast from "react-hot-toast"

import { api, ApiError } from "@/app/lib/api-client"

export interface UseMessageSubmitParams {
  csrfToken: string | null | undefined
  pendingImage: string | null
  isAI: boolean
  enableStreaming: boolean
  sendStreamingMessage: (payload: { message?: string; image?: string }) => Promise<boolean>
  conversationId: string
  emitTyping: (isTyping: boolean) => void
  typingTimeoutRef: { current: NodeJS.Timeout | null }
  setValue: ReturnType<typeof useForm<FieldValues>>["setValue"]
  setPendingImage: (value: string | null | ((prev: string | null) => string | null)) => void
  setIsLoading: (value: boolean | ((prev: boolean) => boolean)) => void
}

export function useMessageSubmit({
  csrfToken,
  pendingImage,
  isAI,
  enableStreaming,
  sendStreamingMessage,
  conversationId,
  emitTyping,
  typingTimeoutRef,
  setValue,
  setPendingImage,
  setIsLoading,
}: UseMessageSubmitParams) {
  const onSubmit: SubmitHandler<FieldValues> = useCallback(
    async (data) => {
      if (!csrfToken) {
        toast.error("Security token not available. Please refresh the page.")
        return
      }
      const rawMessage = typeof data.message === "string" ? data.message : ""
      const trimmedMessage = rawMessage.trim()
      const queuedImage = pendingImage
      if (isAI && !trimmedMessage && !queuedImage) {
        toast.error("Add text or an image before sending")
        return
      }
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current)
      }
      emitTyping(false)
      setValue("message", "", { shouldValidate: true })
      if (isAI) {
        setPendingImage(null)
        if (enableStreaming) {
          const success = await sendStreamingMessage({
            message: trimmedMessage || undefined,
            image: queuedImage || undefined,
          })
          if (!success && queuedImage) {
            setPendingImage(queuedImage)
          }
        } else {
          setIsLoading(true)
          try {
            await api.post(
              "/api/ai/chat",
              {
                message: trimmedMessage || undefined,
                image: queuedImage || undefined,
                conversationId: conversationId,
              },
              { retries: 0, showErrorToast: false }
            )
          } catch (error) {
            if (queuedImage) {
              setPendingImage(queuedImage)
            }
            const message =
              error instanceof ApiError ? error.message : "Failed to send message to AI"
            toast.error(message)
          } finally {
            setIsLoading(false)
          }
        }
      } else {
        setIsLoading(true)
        try {
          await api.post(
            "/api/messages",
            { message: trimmedMessage, conversationId: conversationId },
            { retries: 1, showErrorToast: false }
          )
        } catch (error) {
          const message = error instanceof ApiError ? error.message : "Failed to send message"
          toast.error(message)
        } finally {
          setIsLoading(false)
        }
      }
    },
    [
      conversationId,
      csrfToken,
      emitTyping,
      enableStreaming,
      isAI,
      pendingImage,
      sendStreamingMessage,
      setIsLoading,
      setPendingImage,
      setValue,
      typingTimeoutRef,
    ]
  )

  const handleUpload = useCallback(
    (result: CloudinaryUploadWidgetResults) => {
      if (!csrfToken) {
        toast.error("Security token not available. Please refresh the page.")
        return
      }
      if (result.info && typeof result.info !== "string" && result.info.secure_url) {
        if (isAI) {
          setPendingImage(result.info.secure_url)
          toast.success("Image added to prompt")
        } else {
          api
            .post(
              "/api/messages",
              {
                image: result.info.secure_url,
                conversationId: conversationId,
              },
              { retries: 1, showErrorToast: false }
            )
            .catch((error: unknown) => {
              const message = error instanceof ApiError ? error.message : "Failed to upload image"
              toast.error(message)
            })
        }
      }
    },
    [conversationId, csrfToken, isAI, setPendingImage]
  )

  return { onSubmit, handleUpload }
}
