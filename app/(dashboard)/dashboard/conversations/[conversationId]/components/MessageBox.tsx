"use client"

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react"
import Image from "next/image"
import { useRouter } from "next/navigation"
import clsx from "clsx"
import { format } from "date-fns"
import toast from "react-hot-toast"
import {
  HiArrowPath,
  HiArrowUturnLeft,
  HiOutlineSquare2Stack,
  HiSpeakerWave,
  HiStopCircle,
} from "react-icons/hi2"

import { api, ApiError } from "@/app/lib/api-client"
import { MarkdownRenderer } from "@/app/components/ui/MarkdownRenderer"
import Avatar from "@/app/components/Avatar"
import { type FullMessageType } from "@/app/types"

import ImageModal from "./ImageModal"
import MessageActionsMenu from "./MessageActionsMenu"
import MessageDeleteDialog from "./MessageDeleteDialog"
import MessageEditForm from "./MessageEditForm"
import MessageReactionPicker from "./MessageReactionPicker"
import MessageVariantNav from "./MessageVariantNav"
import ReplyPreview from "./ReplyPreview"
import { useMessageSpeech } from "./useMessageSpeech"

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
  const [imageModalOpen, setImageModalOpen] = useState(false)
  const [showMenu, setShowMenu] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editedBody, setEditedBody] = useState(data.body || "")
  const [isDeleting, setIsDeleting] = useState(false)
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false)
  const [showReactionPicker, setShowReactionPicker] = useState(false)
  const [isSwitchingVariant, setIsSwitchingVariant] = useState(false)
  const [localActiveVariant, setLocalActiveVariant] = useState<number | null>(null)
  const [localBodyOverride, setLocalBodyOverride] = useState<string | null>(null)
  const [isForking, setIsForking] = useState(false)
  const reactionPickerRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  const isOwn = Boolean(currentUserId && currentUserId === data?.sender?.id)
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
      await api.patch(
        `/api/messages/${data.id}`,
        { body: editedBody.trim() },
        { headers: { "X-CSRF-Token": csrfToken }, showErrorToast: false }
      )
      toast.success("Message edited")
      setIsEditing(false)
      setShowMenu(false)
    } catch (error) {
      const message = error instanceof ApiError ? error.message : "Failed to edit message"
      toast.error(message)
      setEditedBody(data.body || "")
    }
  }, [csrfToken, editedBody, data.body, data.id])

  const handleDelete = useCallback(() => {
    setIsDeleteConfirmOpen(true)
  }, [])

  const handleDeleteConfirm = useCallback(async () => {
    if (!csrfToken) {
      toast.error("Security token not available. Please refresh the page.")
      return
    }

    setIsDeleting(true)
    try {
      await api.delete(`/api/messages/${data.id}`, {
        headers: { "X-CSRF-Token": csrfToken },
        showErrorToast: false,
      })
      toast.success("Message deleted")
      setShowMenu(false)
    } catch (error) {
      const message = error instanceof ApiError ? error.message : "Failed to delete message"
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
        await api.post(
          `/api/messages/${data.id}/react`,
          { emoji },
          { headers: { "X-CSRF-Token": csrfToken }, showErrorToast: false }
        )
        setShowReactionPicker(false)
      } catch (error) {
        const message = error instanceof ApiError ? error.message : "Failed to add reaction"
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
        const updated = await api.patch<{ body?: string | null; activeVariant?: number } | null>(
          `/api/messages/${data.id}/variant`,
          { index },
          { headers: { "X-CSRF-Token": csrfToken }, showErrorToast: false }
        )

        if (updated && typeof updated.activeVariant === "number") {
          setLocalActiveVariant(updated.activeVariant)
        }
        if (updated && typeof updated.body === "string") {
          setLocalBodyOverride(updated.body)
        }
      } catch (error) {
        const message = error instanceof ApiError ? error.message : "Failed to switch reply variant"
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
      const result = await api.post<{ id?: string } | null>(
        `/api/conversations/${data.conversationId}/fork`,
        { messageId: data.id },
        { headers: { "X-CSRF-Token": csrfToken }, showErrorToast: false }
      )

      const nextConversationId = result && typeof result.id === "string" ? result.id : null
      if (!nextConversationId) {
        throw new Error("Failed to create branch")
      }

      toast.success("Branch created")
      router.push(`/dashboard/conversations/${nextConversationId}`)
    } catch (error) {
      const message =
        error instanceof ApiError || error instanceof Error
          ? error.message
          : "Failed to create branch"
      toast.error(message)
    } finally {
      setIsForking(false)
    }
  }, [csrfToken, data.conversationId, data.id, isAiConversation, isForking, router])

  const { isSpeechSupported, isSpeaking, handleToggleSpeech } = useMessageSpeech({
    isAI: Boolean(data.isAI),
    text: displayBody,
    isRegenerating: isThisRegenerating,
  })

  // Dismiss reaction picker and message menu on click-outside or Escape
  useEffect(() => {
    if (!showReactionPicker && !showMenu) return

    const handleClickOutside = (e: MouseEvent) => {
      if (reactionPickerRef.current && !reactionPickerRef.current.contains(e.target as Node)) {
        setShowReactionPicker(false)
      }
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false)
      }
    }

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setShowReactionPicker(false)
        setShowMenu(false)
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    document.addEventListener("keydown", handleEscape)
    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
      document.removeEventListener("keydown", handleEscape)
    }
  }, [showReactionPicker, showMenu])

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
    <>
      <MessageDeleteDialog
        open={isDeleteConfirmOpen}
        onOpenChange={setIsDeleteConfirmOpen}
        onConfirm={handleDeleteConfirm}
      />
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
              <MessageEditForm
                value={editedBody}
                onChange={setEditedBody}
                onSave={handleEdit}
                onCancel={handleCancelEdit}
              />
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
                      height={288}
                      width={288}
                      sizes="(max-width: 640px) 100vw, 288px"
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
                <MessageReactionPicker
                  containerRef={reactionPickerRef}
                  open={showReactionPicker}
                  onToggle={() => setShowReactionPicker(!showReactionPicker)}
                  onReact={handleReaction}
                />

                {/* Regenerate button - only show for AI messages */}
                {data.isAI && variants.length > 1 && !data.isDeleted && (
                  <MessageVariantNav
                    variantCount={variants.length}
                    activeIndex={safeActiveVariant}
                    disabled={isSwitchingVariant || isThisRegenerating}
                    onSetVariant={handleSetVariant}
                  />
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
                  <MessageActionsMenu
                    containerRef={menuRef}
                    open={showMenu}
                    isDeleting={isDeleting}
                    onToggle={() => setShowMenu(!showMenu)}
                    onEdit={() => {
                      setIsEditing(true)
                      setShowMenu(false)
                    }}
                    onDelete={handleDelete}
                  />
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
                    type="button"
                    onClick={() => handleReaction(emoji)}
                    className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-sm transition ${
                      hasReacted
                        ? "border-primary bg-primary/10 dark:bg-primary/20"
                        : "border-border bg-background hover:bg-accent"
                    }`}
                    aria-label={`${userIds.length} ${emoji} reaction${userIds.length > 1 ? "s" : ""}, click to toggle`}
                    aria-pressed={Boolean(hasReacted)}
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
    </>
  )
})

export default MessageBox
