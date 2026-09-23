"use client"

import { HiOutlineXMark } from "react-icons/hi2"

import { type UserSummary } from "@/app/types"

interface ReplyMessage {
  id: string
  body: string | null
  image: string | null
  sender: UserSummary
}

interface ReplyPreviewProps {
  replyTo: ReplyMessage
  onClose?: () => void
  onClick?: () => void
  showClose?: boolean
}

function truncateText(text: string, maxLength: number) {
  if (text.length <= maxLength) return text
  return text.substring(0, maxLength) + "…"
}

const ReplyPreview: React.FC<ReplyPreviewProps> = ({
  replyTo,
  onClose,
  onClick,
  showClose = false,
}) => {
  const content = (
    <>
      <div className="flex items-center gap-2">
        <p className="truncate text-xs font-medium text-primary-accent">
          Replying to {replyTo.sender.name}
        </p>
      </div>
      {replyTo.body && (
        <p className="mt-1 break-words text-sm text-muted-foreground">
          {truncateText(replyTo.body, 100)}
        </p>
      )}
      {replyTo.image && !replyTo.body && (
        <p className="mt-1 text-sm italic text-muted-foreground">Image</p>
      )}
    </>
  )

  return (
    <div
      className={`flex items-start gap-2 rounded-md border border-border/50 bg-muted/50 p-3 ${
        onClick ? "hover:bg-muted" : ""
      }`}
    >
      {onClick ? (
        // Clickable previews are a real button; the close button stays a sibling
        // so no interactive element is nested in another.
        <button
          type="button"
          onClick={onClick}
          className="min-w-0 flex-1 cursor-pointer overflow-hidden text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {content}
        </button>
      ) : (
        <div className="min-w-0 flex-1 overflow-hidden">{content}</div>
      )}
      {showClose && onClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label="Cancel reply"
          className="rounded-md text-muted-foreground/70 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <HiOutlineXMark size={20} aria-hidden="true" />
        </button>
      )}
    </div>
  )
}

export default ReplyPreview
