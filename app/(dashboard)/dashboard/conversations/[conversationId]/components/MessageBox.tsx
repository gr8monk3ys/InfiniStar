"use client"

import { memo, useCallback, useMemo, useState } from "react"
import Image from "next/image"
import axios, { isAxiosError } from "axios"
import clsx from "clsx"
import { format } from "date-fns"
import { useSession } from "next-auth/react"
import toast from "react-hot-toast"
import {
  HiArrowPath,
  HiArrowUturnLeft,
  HiEllipsisVertical,
  HiFaceSmile,
  HiPencil,
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
  onReply?: (message: FullMessageType) => void
  onRegenerate?: (messageId: string) => void
  isRegenerating?: boolean
  regeneratingMessageId?: string | null
}

const MessageBox: React.FC<MessageBoxProps> = memo(function MessageBox({
  data,
  isLast,
  onReply,
  onRegenerate,
  isRegenerating = false,
  regeneratingMessageId = null,
}) {
  const session = useSession()
  const [imageModalOpen, setImageModalOpen] = useState(false)
  const [showMenu, setShowMenu] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editedBody, setEditedBody] = useState(data.body || "")
  const [isDeleting, setIsDeleting] = useState(false)
  const [showReactionPicker, setShowReactionPicker] = useState(false)

  const commonEmojis = ["👍", "❤️", "😄", "🎉", "🔥", "👏"]

  const isOwn = session.data?.user?.email === data?.sender?.email
  const seenList = (data.seen || [])
    .filter((user) => user.email !== data?.sender?.email)
    .map((user) => user.name)
    .join(", ")

  const container = clsx("flex gap-3 p-4", isOwn && "justify-end")
  const avatar = clsx(isOwn && "order-2")
  const body = clsx("flex flex-col gap-2", isOwn && "items-end")

  // Check if message body contains code blocks (for AI messages)
  const hasCodeBlocks = useMemo(() => {
    if (!data.body) return false
    return data.body.includes("```") || data.body.includes("`")
  }, [data.body])

  // AI messages with code blocks get special styling
  const isAiWithCode = data.isAI && hasCodeBlocks

  const message = clsx(
    "text-sm w-fit overflow-hidden",
    isOwn ? "bg-sky-500 text-white" : "bg-secondary text-secondary-foreground",
    data.image
      ? "rounded-md p-0"
      : isAiWithCode
      ? "rounded-lg py-2 px-3 max-w-full sm:max-w-[80%] md:max-w-[70%]"
      : "rounded-full py-2 px-3"
  )

  const handleEdit = useCallback(async () => {
    if (!editedBody.trim() || editedBody === data.body) {
      setIsEditing(false)
      return
    }

    try {
      await axios.patch(`/api/messages/${data.id}`, {
        body: editedBody.trim(),
      })
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
  }, [editedBody, data.body, data.id])

  const handleDelete = useCallback(async () => {
    if (!confirm("Are you sure you want to delete this message?")) {
      return
    }

    setIsDeleting(true)
    try {
      await axios.delete(`/api/messages/${data.id}`)
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
  }, [data.id])

  const handleCancelEdit = useCallback(() => {
    setEditedBody(data.body || "")
    setIsEditing(false)
  }, [data.body])

  const handleReaction = useCallback(
    async (emoji: string) => {
      try {
        await axios.post(`/api/messages/${data.id}/react`, { emoji })
        setShowReactionPicker(false)
      } catch (error) {
        const message =
          isAxiosError(error) && error.response?.data?.error
            ? error.response.data.error
            : "Failed to add reaction"
        toast.error(message)
      }
    },
    [data.id]
  )

  // Parse reactions from JSON
  const reactions = (data.reactions as Record<string, string[]>) || {}
  const currentUserId = session.data?.user?.id

  // Don't show deleted messages
  if (data.isDeleted) {
    return (
      <div className={container} role="article" aria-label="Deleted message">
        <div className={avatar}>
          <Avatar user={data.sender} />
        </div>
        <div className={body}>
          <div className="flex items-center gap-1">
            <div className="text-sm text-muted-foreground">{data.sender.name}</div>
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
    <div className={container} role="article" aria-label={`Message from ${data.sender.name}`}>
      <div className={avatar}>
        <Avatar user={data.sender} />
      </div>
      <div className={body}>
        <div className="flex items-center gap-1">
          <div className="text-sm text-muted-foreground">{data.sender.name}</div>
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
                  className="rounded bg-sky-500 px-3 py-1 text-sm text-white hover:bg-sky-600"
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
                ) : data.isAI && data.body ? (
                  <MarkdownRenderer content={data.body} />
                ) : (
                  <div>{data.body}</div>
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

              {/* Edit/Delete menu - only show for own messages and not AI messages */}
              {isOwn && !data.isAI && !data.image && (
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
              const hasReacted = currentUserId && userIds.includes(currentUserId)
              return (
                <button
                  key={emoji}
                  onClick={() => handleReaction(emoji)}
                  className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-sm transition ${
                    hasReacted
                      ? "border-sky-500 bg-sky-100 dark:bg-sky-900/30"
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
