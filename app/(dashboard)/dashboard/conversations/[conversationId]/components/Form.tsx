"use client"

import { useState } from "react"
import axios from "axios"
import { CldUploadButton, type CloudinaryUploadWidgetResults } from "next-cloudinary"
import { useForm, type FieldValues, type SubmitHandler } from "react-hook-form"
import toast from "react-hot-toast"
import { HiPaperAirplane, HiPhoto } from "react-icons/hi2"

import useConversation from "@/app/(dashboard)/dashboard/hooks/useConversation"
import { useAiChatStream } from "@/app/hooks/useAiChatStream"
import { useCsrfToken } from "@/app/hooks/useCsrfToken"

import MessageInput from "./MessageInput"

interface FormProps {
  isAI?: boolean
  enableStreaming?: boolean // New prop to enable/disable streaming
}

const Form: React.FC<FormProps> = ({ isAI = false, enableStreaming = true }) => {
  const { conversationId } = useConversation()
  const [isLoading, setIsLoading] = useState(false)
  const { token: csrfToken } = useCsrfToken()

  // Set up streaming hook for AI conversations
  const { sendMessage: sendStreamingMessage, isStreaming } = useAiChatStream({
    conversationId,
    csrfToken,
    onComplete: () => {
      toast.success("AI response complete")
    },
    onError: (error) => {
      toast.error(`AI error: ${error}`)
    },
  })

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<FieldValues>({
    defaultValues: {
      message: "",
    },
  })

  const onSubmit: SubmitHandler<FieldValues> = async (data) => {
    if (!csrfToken) {
      toast.error("Security token not available. Please refresh the page.")
      return
    }

    setValue("message", "", { shouldValidate: true })

    const headers = {
      "X-CSRF-Token": csrfToken,
      "Content-Type": "application/json",
    }

    if (isAI) {
      // Use streaming for AI if enabled
      if (enableStreaming) {
        await sendStreamingMessage(data.message)
      } else {
        // Fallback to non-streaming endpoint
        setIsLoading(true)
        try {
          await axios.post(
            "/api/ai/chat",
            {
              message: data.message,
              conversationId: conversationId,
            },
            { headers }
          )
        } catch (error) {
          console.error("AI chat error:", error)
          toast.error("Failed to send message to AI")
        } finally {
          setIsLoading(false)
        }
      }
    } else {
      // Send to regular messages endpoint
      axios
        .post(
          "/api/messages",
          {
            ...data,
            conversationId: conversationId,
          },
          { headers }
        )
        .catch((error) => {
          console.error("Message send error:", error)
          toast.error("Failed to send message")
        })
    }
  }

  const handleUpload = (result: CloudinaryUploadWidgetResults) => {
    if (!csrfToken) {
      toast.error("Security token not available. Please refresh the page.")
      return
    }

    if (result.info && typeof result.info !== "string" && result.info.secure_url) {
      axios
        .post(
          "/api/messages",
          {
            image: result.info.secure_url,
            conversationId: conversationId,
          },
          {
            headers: { "X-CSRF-Token": csrfToken },
          }
        )
        .catch((error) => {
          console.error("Image upload error:", error)
          toast.error("Failed to upload image")
        })
    }
  }

  return (
    <div
      className="flex w-full items-center gap-2 border-t bg-white p-4"
      role="region"
      aria-label="Message input area"
    >
      {!isAI && (
        <CldUploadButton options={{ maxFiles: 1 }} onUpload={handleUpload} uploadPreset="pgc9ehd5">
          <HiPhoto
            size={30}
            className="text-sky-500"
            aria-label="Upload image"
            role="button"
            tabIndex={0}
          />
        </CldUploadButton>
      )}
      <form
        onSubmit={handleSubmit(onSubmit)}
        className="flex w-full items-center gap-2 lg:gap-4"
        aria-label={isAI ? "AI chat message form" : "Send message form"}
      >
        <MessageInput
          id="message"
          register={register}
          errors={errors}
          required
          placeholder={isAI ? "Ask me anything..." : "Write a message"}
        />
        <button
          type="submit"
          disabled={isLoading || isStreaming}
          aria-label={isAI ? "Send message to AI" : "Send message"}
          aria-busy={isLoading || isStreaming}
          aria-disabled={isLoading || isStreaming}
          className={`
            cursor-pointer
            rounded-full
            ${isAI ? "bg-gradient-to-r from-purple-500 to-pink-500" : "bg-sky-500"}
            p-2
            transition
            ${isAI ? "hover:opacity-75" : "hover:bg-sky-600"}
            ${isLoading || isStreaming ? "cursor-not-allowed opacity-50" : ""}
          `}
        >
          <HiPaperAirplane
            size={18}
            className={`text-white ${isStreaming ? "animate-pulse" : ""}`}
            aria-hidden="true"
          />
        </button>
      </form>
    </div>
  )
}

export default Form
