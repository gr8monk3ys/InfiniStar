"use client"

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { useUser } from "@clerk/nextjs"
import axios, { isAxiosError } from "axios"
import clsx from "clsx"
import { format } from "date-fns"
import toast from "react-hot-toast"
import {
  HiArrowPath,
  HiArrowUturnLeft,
  HiChevronLeft,
  HiChevronRight,
  HiEllipsisVertical,
  HiFaceSmile,
  HiOutlineSquare2Stack,
  HiPencil,
  HiSpeakerWave,
  HiStopCircle,
  HiTrash,
} from "react-icons/hi2"

import { MarkdownRenderer } from "@/app/components/ui/MarkdownRenderer"
import Avatar from "@/app/components/Avatar"
import { type FullMessageType } from "@/app/types"

import ImageModal from "./ImageModal"
import ReplyPreview from "./ReplyPreview"

interface MessageBoxProps {
  data: FullMessageType
  isLast?: boolean
  characterName?: string | null
  characterAvatar?: string | null
  csrfToken?: string | null
  currentUserId?: string | null
  onReply?: (message: FullMessageType) => void
  onRegenerate?: (messageId: string) => void
  isRegenerating?: boolean
  regeneratingMessageId?: string | null
  regeneratingContent?: string
}

const MessageBox: React.FC<MessageBoxProps> = memo(function MessageBox({
  data,
  isLast,
  characterName,
  characterAvatar,
  csrfToken,
  currentUserId,
  onReply,
  onRegenerate,
  isRegenerating = false,
  regeneratingMessageId = null,
  regeneratingContent,
}) {
  const router = useRouter()
  const { user } = useUser()
  const [imageModalOpen, setImageModalOpen] = useState(false)
  const [showMenu, setShowMenu] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editedBody, setEditedBody] = useState(data.body || "")
  const [isDeleting, setIsDeleting] = useState(false)
  const [showReactionPicker, setShowReactionPicker] = useState(false)
  const [isSpeechSupported, setIsSpeechSupported] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [isSwitchingVariant, setIsSwitchingVariant] = useState(false)
  const [localActiveVariant, setLocalActiveVariant] = useState<number | null>(null)
  const [localBodyOverride, setLocalBodyOverride] = useState<string | null>(null)
  const [isForking, setIsForking] = useState(false)
  const speechUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null)

  const commonEmojis = ["👍", "❤️", "😄", "🎉", "🔥", "👏"]

  const userEmail = user?.emailAddresses[0]?.emailAddress
  const isOwn = userEmail === data?.sender?.email
  const seenList = (data.seen || [])
    .filter((user: { email?: string | null }) => user.email !== data?.sender?.email)
    .map((user: { name?: string | null }) => user.name)
    .join(", ")

  const container = clsx("flex gap-3 p-4", isOwn && "justify-end")
  const avatar = clsx(isOwn && "order-2")
  const body = clsx("flex flex-col gap-2", isOwn && "items-end")

  const isAiConversation = Boolean(onRegenerate)

  const variants = useMemo(() => {
    if (!Array.isArray(data.variants)) return []
    return data.variants.filter((variant): variant is string => typeof variant === "string")
  }, [data.variants])

  const activeVariant =
    localActiveVariant ??
    (typeof data.activeVariant === "number" && data.activeVariant >= 0 ? data.activeVariant : 0)
  const safeActiveVariant =
    variants.length > 0 ? Math.min(Math.max(activeVariant, 0), variants.length - 1) : 0

  useEffect(() => {
    if (localActiveVariant === null && localBodyOverride === null) return

    if (
      localActiveVariant !== null &&
      typeof data.activeVariant === "number" &&
      data.activeVariant === localActiveVariant &&
      (localBodyOverride === null || data.body === localBodyOverride)
    ) {
      setLocalActiveVariant(null)
      setLocalBodyOverride(null)
    }
  }, [data.activeVariant, data.body, localActiveVariant, localBodyOverride])

  const isThisRegenerating = Boolean(
    data.isAI && isRegenerating && regeneratingMessageId === data.id
  )
  const baseBody = localBodyOverride ?? data.body ?? ""
  const displayBody = isThisRegenerating ? (regeneratingContent ?? "") : baseBody

  // Check if message body contains code blocks (for AI messages)
  const hasCodeBlocks = useMemo(() => {
    if (!displayBody) return false
    return displayBody.includes("```") || displayBody.includes("`")
  }, [displayBody])

  // AI messages with code blocks get special styling
  const isAiWithCode = data.isAI && hasCodeBlocks

  const message = clsx(
    "text-sm w-fit overflow-hidden",
    isOwn ? "chat-bubble-user" : "chat-bubble-ai",
    data.image
      ? "rounded-md p-0"
      : isAiWithCode
        ? "rounded-2xl py-2.5 px-4 max-w-full sm:max-w-[80%] md:max-w-[70%]"
        : "rounded-2xl py-2.5 px-4"
  )

  const handleEdit = useCallback(async () => {
    if (!editedBody.trim() || editedBody === data.body) {
      setIsEditing(false)
      return
    }

    if (!csrfToken) {
      toast.error("Security token not available. Please refresh the page.")
      return
    }

    try {
      await axios.patch(
        `/api/messages/${data.id}`,
        { body: editedBody.trim() },
        { headers: { "X-CSRF-Token": csrfToken } }
      )
      toast.success("Message edited")
      setIsEditing(false)
      setShowMenu(false)
    } catch (error) {
      const message =
        isAxiosError(error) && error.response?.data?.error
          ? error.response.data.error
          : "Failed to edit message"
      toast.error(message)
      setEditedBody(data.body || "")
    }
  }, [csrfToken, editedBody, data.body, data.id])

  const handleDelete = useCallback(async () => {
    if (!confirm("Are you sure you want to delete this message?")) {
      return
    }

    if (!csrfToken) {
      toast.error("Security token not available. Please refresh the page.")
      return
    }

    setIsDeleting(true)
    try {
      await axios.delete(`/api/messages/${data.id}`, { headers: { "X-CSRF-Token": csrfToken } })
      toast.success("Message deleted")
      setShowMenu(false)
    } catch (error) {
      const message =
        isAxiosError(error) && error.response?.data?.error
          ? error.response.data.error
          : "Failed to delete message"
      toast.error(message)
    } finally {
      setIsDeleting(false)
    }
  }, [csrfToken, data.id])

  const handleCancelEdit = useCallback(() => {
    setEditedBody(data.body || "")
    setIsEditing(false)
  }, [data.body])

  const handleReaction = useCallback(
    async (emoji: string) => {
      if (!csrfToken) {
        toast.error("Security token not available. Please refresh the page.")
        return
      }

      try {
        await axios.post(
          `/api/messages/${data.id}/react`,
          { emoji },
          { headers: { "X-CSRF-Token": csrfToken } }
        )
        setShowReactionPicker(false)
      } catch (error) {
        const message =
          isAxiosError(error) && error.response?.data?.error
            ? error.response.data.error
            : "Failed to add reaction"
        toast.error(message)
      }
    },
    [csrfToken, data.id]
  )

  const handleSetVariant = useCallback(
    async (index: number) => {
      if (!csrfToken) {
        toast.error("Security token not available. Please refresh the page.")
        return
      }

      if (!data.isAI || variants.length === 0) {
        return
      }

      if (index < 0 || index >= variants.length) {
        return
      }

      if (isSwitchingVariant || isThisRegenerating) {
        return
      }

      setIsSwitchingVariant(true)
      setLocalActiveVariant(index)
      setLocalBodyOverride(variants[index])

      try {
        const response = await axios.patch(
          `/api/messages/${data.id}/variant`,
          { index },
          { headers: { "X-CSRF-Token": csrfToken } }
        )

        const updated = response.data as { body?: string | null; activeVariant?: number } | null
        if (updated && typeof updated.activeVariant === "number") {
          setLocalActiveVariant(updated.activeVariant)
        }
        if (updated && typeof updated.body === "string") {
          setLocalBodyOverride(updated.body)
        }
      } catch (error) {
        const message =
          isAxiosError(error) && error.response?.data?.error
            ? error.response.data.error
            : "Failed to switch reply variant"
        toast.error(message)
        setLocalActiveVariant(null)
        setLocalBodyOverride(null)
      } finally {
        setIsSwitchingVariant(false)
      }
    },
    [csrfToken, data.id, data.isAI, isSwitchingVariant, isThisRegenerating, variants]
  )

  const handleForkConversation = useCallback(async () => {
    if (!csrfToken) {
      toast.error("Security token not available. Please refresh the page.")
      return
    }

    if (!isAiConversation) {
      return
    }

    if (isForking) {
      return
    }

    setIsForking(true)

    try {
      const response = await axios.post(
        `/api/conversations/${data.conversationId}/fork`,
        { messageId: data.id },
        { headers: { "X-CSRF-Token": csrfToken } }
      )

      const nextConversationId =
        response.data && typeof response.data.id === "string" ? response.data.id : null
      if (!nextConversationId) {
        throw new Error("Failed to create branch")
      }

      toast.success("Branch created")
      router.push(`/dashboard/conversations/${nextConversationId}`)
    } catch (error) {
      const message =
        isAxiosError(error) && error.response?.data?.error
          ? error.response.data.error
          : error instanceof Error
            ? error.message
            : "Failed to create branch"
      toast.error(message)
    } finally {
      setIsForking(false)
    }
  }, [csrfToken, data.conversationId, data.id, isAiConversation, isForking, router])

  const stopSpeech = useCallback(() => {
    if (!isSpeechSupported || typeof window === "undefined") {
      return
    }

    window.speechSynthesis.cancel()
    speechUtteranceRef.current = null
    setIsSpeaking(false)
  }, [isSpeechSupported])

  const handleToggleSpeech = useCallback(() => {
    if (
      !isSpeechSupported ||
      !data.isAI ||
      !displayBody ||
      isThisRegenerating ||
      typeof window === "undefined"
    ) {
      return
    }

    if (isSpeaking) {
      stopSpeech()
      return
    }

    const utterance = new SpeechSynthesisUtterance(displayBody)
    utterance.rate = 1
    utterance.pitch = 1

    utterance.onend = () => {
      if (speechUtteranceRef.current === utterance) {
        speechUtteranceRef.current = null
        setIsSpeaking(false)
      }
    }

    utterance.onerror = () => {
      if (speechUtteranceRef.current === utterance) {
        speechUtteranceRef.current = null
        setIsSpeaking(false)
        toast.error("Text-to-speech failed")
      }
    }

    speechUtteranceRef.current = utterance
    window.speechSynthesis.cancel()
    window.speechSynthesis.speak(utterance)
    setIsSpeaking(true)
  }, [isSpeechSupported, data.isAI, displayBody, isSpeaking, isThisRegenerating, stopSpeech])

  useEffect(() => {
    const supported =
      typeof window !== "undefined" &&
      "speechSynthesis" in window &&
      typeof SpeechSynthesisUtterance !== "undefined"
    setIsSpeechSupported(supported)

    return () => {
      if (speechUtteranceRef.current && typeof window !== "undefined") {
        window.speechSynthesis.cancel()
        speechUtteranceRef.current = null
      }
    }
  }, [])

  // Parse reactions from JSON
  const reactions = (data.reactions as Record<string, string[]>) || {}
  const viewerId = currentUserId || null

  // Don't show deleted messages
  if (data.isDeleted) {
    return (
      <div className={container} role="article" aria-label="Deleted message">
        <div className={avatar}>
          {data.isAI && characterAvatar ? (
            <div className="relative size-9 overflow-hidden rounded-full">
              <Image
                src={characterAvatar}
                alt={characterName || "AI"}
                fill
                className="object-cover"
              />
            </div>
          ) : (
            <Avatar user={data.sender} />
          )}
        </div>
        <div className={body}>
          <div className="flex items-center gap-1">
            <div className="text-sm text-muted-foreground">
              {data.isAI && characterName ? characterName : data.sender.name}
            </div>
            <div className="text-xs text-muted-foreground">
              {format(new Date(data.createdAt), "p")}
            </div>
          </div>
          <div className="rounded-full bg-secondary px-3 py-2 text-sm italic text-muted-foreground">
            This message was deleted
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      className={container}
      role="article"
      aria-label={`Message from ${data.isAI && characterName ? characterName : data.sender.name}`}
    >
      <div className={avatar}>
        {data.isAI && characterAvatar ? (
          <div className="relative size-9 overflow-hidden rounded-full">
            <Image
              src={characterAvatar}
              alt={characterName || "AI"}
              fill
              className="object-cover"
            />
          </div>
        ) : (
          <Avatar user={data.sender} />
        )}
      </div>
      <div className={body}>
        <div className="flex items-center gap-1">
          <div className="text-sm text-muted-foreground">
            {data.isAI && characterName ? characterName : data.sender.name}
          </div>
          <div
            className="text-xs text-muted-foreground"
            aria-label={`Sent at ${format(new Date(data.createdAt), "p")}`}
          >
            {format(new Date(data.createdAt), "p")}
          </div>
          {data.editedAt && (
            <div
              className="text-xs italic text-muted-foreground"
              title={`Edited ${format(new Date(data.editedAt), "PPp")}`}
            >
              (edited)
            </div>
          )}
        </div>

        <div className="relative flex items-start gap-2">
          {isEditing ? (
            <div className="flex w-full flex-col gap-2">
              <textarea
                value={editedBody}
                onChange={(e) => setEditedBody(e.target.value)}
                className="w-full rounded-lg border border-border bg-background p-2 text-sm text-foreground focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                rows={3}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault()
                    handleEdit()
                  }
                  if (e.key === "Escape") {
                    handleCancelEdit()
                  }
                }}
              />
              <div className="flex gap-2">
                <button
                  onClick={handleEdit}
                  className="rounded-lg bg-primary px-3 py-1 text-sm text-primary-foreground hover:bg-primary/90"
                >
                  Save
                </button>
                <button
                  onClick={handleCancelEdit}
                  className="rounded border border-border px-3 py-1 text-sm text-secondary-foreground hover:bg-accent"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className={message}>
                {/* Show reply preview if this message is replying to another */}
                {data.replyTo && (
                  <div className="mb-2">
                    <ReplyPreview replyTo={data.replyTo} />
                  </div>
                )}

                <ImageModal
                  src={data.image}
                  isOpen={imageModalOpen}
                  onClose={() => setImageModalOpen(false)}
                />
                {data.image ? (
                  <Image
                    alt={`Image attachment from ${data.sender.name}`}
                    height="288"
                    width="288"
                    onClick={() => setImageModalOpen(true)}
                    src={data.image}
                    className="
                      translate
                      cursor-pointer
                      object-cover
                      transition
                      hover:scale-110
                    "
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault()
                        setImageModalOpen(true)
                      }
                    }}
                    aria-label="Click to view full-size image"
                  />
                ) : data.audioUrl ? (
                  <div className="flex flex-col gap-2">
                    <audio
                      controls
                      preload="metadata"
                      src={data.audioUrl}
                      className="w-72 max-w-full"
                    />
                    {displayBody ? (
                      <div className="text-sm text-muted-foreground">{displayBody}</div>
                    ) : null}
                  </div>
                ) : data.isAI ? (
                  displayBody ? (
                    <MarkdownRenderer content={displayBody} />
                  ) : isThisRegenerating ? (
                    <div className="text-sm italic text-muted-foreground">Regenerating...</div>
                  ) : null
                ) : (
                  <div>{displayBody}</div>
                )}
              </div>

              {/* Reply button */}
              {onReply && !data.isDeleted && (
                <button
                  onClick={() => onReply(data)}
                  className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                  aria-label="Reply to message"
                  title="Reply"
                >
                  <HiArrowUturnLeft size={16} />
                </button>
              )}

              {/* Reaction button */}
              <div className="relative">
                <button
                  onClick={() => setShowReactionPicker(!showReactionPicker)}
                  className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                  aria-label="Add reaction"
                >
                  <HiFaceSmile size={16} />
                </button>

                {showReactionPicker && (
                  <div className="absolute left-0 z-10 mt-1 flex gap-1 rounded-md border border-border bg-popover p-2 shadow-lg">
                    {commonEmojis.map((emoji) => (
                      <button
                        key={emoji}
                        onClick={() => handleReaction(emoji)}
                        className="rounded p-1 text-xl hover:bg-accent"
                        title={`React with ${emoji}`}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Regenerate button - only show for AI messages */}
              {data.isAI && variants.length > 1 && !data.isDeleted && (
                <div
                  className={clsx(
                    "flex items-center gap-1 rounded-md border border-border bg-background/50 px-1 py-0.5",
                    (isSwitchingVariant || isThisRegenerating) && "opacity-60"
                  )}
                  aria-label="Alternative replies"
                  title="Alternative replies"
                >
                  <button
                    type="button"
                    onClick={() => {
                      const prevIndex =
                        safeActiveVariant === 0 ? variants.length - 1 : safeActiveVariant - 1
                      handleSetVariant(prevIndex).catch(() => {
                        // handled in function
                      })
                    }}
                    disabled={isSwitchingVariant || isThisRegenerating}
                    className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-50"
                    aria-label="Previous reply variant"
                  >
                    <HiChevronLeft size={16} />
                  </button>
                  <span className="min-w-10 text-center text-[10px] text-muted-foreground">
                    {safeActiveVariant + 1}/{variants.length}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      const nextIndex =
                        safeActiveVariant === variants.length - 1 ? 0 : safeActiveVariant + 1
                      handleSetVariant(nextIndex).catch(() => {
                        // handled in function
                      })
                    }}
                    disabled={isSwitchingVariant || isThisRegenerating}
                    className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-50"
                    aria-label="Next reply variant"
                  >
                    <HiChevronRight size={16} />
                  </button>
                </div>
              )}

              {/* Branch conversation from this point (AI conversations only) */}
              {isAiConversation && !data.isDeleted && (
                <button
                  type="button"
                  onClick={() => {
                    handleForkConversation().catch(() => {
                      // handled in function
                    })
                  }}
                  disabled={isForking}
                  className={clsx(
                    "rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground",
                    isForking && "opacity-60"
                  )}
                  aria-label="Branch conversation from here"
                  title="Branch from here"
                >
                  <HiOutlineSquare2Stack size={16} />
                </button>
              )}

              {/* Regenerate button - only show for AI messages */}
              {data.isAI && onRegenerate && !data.isDeleted && (
                <button
                  onClick={() => onRegenerate(data.id)}
                  disabled={isRegenerating}
                  className={clsx(
                    "rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground",
                    isRegenerating &&
                      regeneratingMessageId === data.id &&
                      "animate-spin text-purple-500"
                  )}
                  aria-label="Regenerate AI response"
                  title={
                    isRegenerating && regeneratingMessageId === data.id
                      ? "Regenerating..."
                      : "Regenerate response"
                  }
                >
                  <HiArrowPath size={16} />
                </button>
              )}

              {/* Text-to-speech button for AI responses */}
              {data.isAI && displayBody && isSpeechSupported && !isThisRegenerating && (
                <button
                  onClick={handleToggleSpeech}
                  className={clsx(
                    "rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground",
                    isSpeaking && "text-primary"
                  )}
                  aria-label={isSpeaking ? "Stop reading message aloud" : "Read message aloud"}
                  title={isSpeaking ? "Stop reading aloud" : "Read aloud"}
                >
                  {isSpeaking ? <HiStopCircle size={16} /> : <HiSpeakerWave size={16} />}
                </button>
              )}

              {/* Edit/Delete menu - only show for own messages and not AI messages */}
              {isOwn && !data.isAI && !data.image && !data.audioUrl && (
                <div className="relative">
                  <button
                    onClick={() => setShowMenu(!showMenu)}
                    className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                    aria-label="Message options"
                  >
                    <HiEllipsisVertical size={16} />
                  </button>

                  {showMenu && (
                    <div className="absolute right-0 z-10 mt-1 w-32 rounded-md border border-border bg-popover shadow-lg">
                      <button
                        onClick={() => {
                          setIsEditing(true)
                          setShowMenu(false)
                        }}
                        className="flex w-full items-center gap-2 px-3 py-2 text-sm text-popover-foreground hover:bg-accent"
                        disabled={isDeleting}
                      >
                        <HiPencil size={16} />
                        Edit
                      </button>
                      <button
                        onClick={handleDelete}
                        className="flex w-full items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-100 dark:hover:bg-red-900/20"
                        disabled={isDeleting}
                      >
                        <HiTrash size={16} />
                        {isDeleting ? "Deleting..." : "Delete"}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Display reactions */}
        {Object.keys(reactions).length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1">
            {Object.entries(reactions).map(([emoji, userIds]) => {
              const hasReacted = viewerId && userIds.includes(viewerId)
              return (
                <button
                  key={emoji}
                  onClick={() => handleReaction(emoji)}
                  className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-sm transition ${
                    hasReacted
                      ? "border-primary bg-primary/10 dark:bg-primary/20"
                      : "border-border bg-background hover:bg-accent"
                  }`}
                  title={`${userIds.length} reaction${userIds.length > 1 ? "s" : ""}`}
                >
                  <span>{emoji}</span>
                  <span className="text-xs text-muted-foreground">{userIds.length}</span>
                </button>
              )
            })}
          </div>
        )}
        {isLast && isOwn && seenList.length > 0 && (
          <div className="text-xs font-light text-muted-foreground">{`Seen by ${seenList}`}</div>
        )}
      </div>
    </div>
  )
})

export default MessageBox
