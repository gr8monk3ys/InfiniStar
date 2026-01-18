"use client"

import { memo, useState } from "react"
import Image from "next/image"
import axios, { isAxiosError } from "axios"
import clsx from "clsx"
import { format } from "date-fns"
import { useSession } from "next-auth/react"
import toast from "react-hot-toast"
import {
  HiArrowUturnLeft,
  HiEllipsisVertical,
  HiFaceSmile,
  HiPencil,
  HiTrash,
} from "react-icons/hi2"

import Avatar from "@/app/components/Avatar"
import { type FullMessageType } from "@/app/types"

import ImageModal from "./ImageModal"
import ReplyPreview from "./ReplyPreview"

interface MessageBoxProps {
  data: FullMessageType
  isLast?: boolean
  onReply?: (message: FullMessageType) => void
}

const MessageBox: React.FC<MessageBoxProps> = memo(function MessageBox({ data, isLast, onReply }) {
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

  const message = clsx(
    "text-sm w-fit overflow-hidden",
    isOwn ? "bg-sky-500 text-white" : "bg-gray-100",
    data.image ? "rounded-md p-0" : "rounded-full py-2 px-3"
  )

  const handleEdit = async () => {
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
  }

  const handleDelete = async () => {
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
  }

  const handleCancelEdit = () => {
    setEditedBody(data.body || "")
    setIsEditing(false)
  }

  const handleReaction = async (emoji: string) => {
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
  }

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
            <div className="text-sm text-gray-500">{data.sender.name}</div>
            <div className="text-xs text-gray-400">{format(new Date(data.createdAt), "p")}</div>
          </div>
          <div className="rounded-full bg-gray-100 px-3 py-2 text-sm italic text-gray-500">
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
          <div className="text-sm text-gray-500">{data.sender.name}</div>
          <div
            className="text-xs text-gray-400"
            aria-label={`Sent at ${format(new Date(data.createdAt), "p")}`}
          >
            {format(new Date(data.createdAt), "p")}
          </div>
          {data.editedAt && (
            <div
              className="text-xs italic text-gray-400"
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
                className="w-full rounded-lg border border-gray-300 p-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
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
                  className="rounded border border-gray-300 px-3 py-1 text-sm text-gray-700 hover:bg-gray-50"
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
                ) : (
                  <div>{data.body}</div>
                )}
              </div>

              {/* Reply button */}
              {onReply && !data.isDeleted && (
                <button
                  onClick={() => onReply(data)}
                  className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
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
                  className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                  aria-label="Add reaction"
                >
                  <HiFaceSmile size={16} />
                </button>

                {showReactionPicker && (
                  <div className="absolute left-0 z-10 mt-1 flex gap-1 rounded-md border border-gray-200 bg-white p-2 shadow-lg">
                    {commonEmojis.map((emoji) => (
                      <button
                        key={emoji}
                        onClick={() => handleReaction(emoji)}
                        className="rounded p-1 text-xl hover:bg-gray-100"
                        title={`React with ${emoji}`}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Edit/Delete menu - only show for own messages and not AI messages */}
              {isOwn && !data.isAI && !data.image && (
                <div className="relative">
                  <button
                    onClick={() => setShowMenu(!showMenu)}
                    className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                    aria-label="Message options"
                  >
                    <HiEllipsisVertical size={16} />
                  </button>

                  {showMenu && (
                    <div className="absolute right-0 z-10 mt-1 w-32 rounded-md border border-gray-200 bg-white shadow-lg">
                      <button
                        onClick={() => {
                          setIsEditing(true)
                          setShowMenu(false)
                        }}
                        className="flex w-full items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                        disabled={isDeleting}
                      >
                        <HiPencil size={16} />
                        Edit
                      </button>
                      <button
                        onClick={handleDelete}
                        className="flex w-full items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50"
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
                      ? "border-sky-500 bg-sky-50"
                      : "border-gray-200 bg-white hover:bg-gray-50"
                  }`}
                  title={`${userIds.length} reaction${userIds.length > 1 ? "s" : ""}`}
                >
                  <span>{emoji}</span>
                  <span className="text-xs text-gray-600">{userIds.length}</span>
                </button>
              )
            })}
          </div>
        )}
        {isLast && isOwn && seenList.length > 0 && (
          <div
            className="
              text-xs 
              font-light 
              text-gray-500
            "
          >
            {`Seen by ${seenList}`}
          </div>
        )}
      </div>
    </div>
  )
})

export default MessageBox
