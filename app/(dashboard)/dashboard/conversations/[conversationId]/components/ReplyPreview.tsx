"use client"

import { type User } from "@prisma/client"
import { HiOutlineXMark } from "react-icons/hi2"

interface ReplyMessage {
  id: string
  body: string | null
  image: string | null
  sender: User
}

interface ReplyPreviewProps {
  replyTo: ReplyMessage
  onClose?: () => void
  onClick?: () => void
  showClose?: boolean
}

const ReplyPreview: React.FC<ReplyPreviewProps> = ({
  replyTo,
  onClose,
  onClick,
  showClose = false,
}) => {
  const truncateText = (text: string, maxLength: number) => {
    if (text.length <= maxLength) return text
    return text.substring(0, maxLength) + "..."
  }

  return (
    <div
      onClick={onClick}
      className={`flex items-start gap-2 rounded-md border border-border/50 bg-muted/50 p-3 ${
        onClick ? "cursor-pointer hover:bg-muted" : ""
      }`}
    >
      <div className="flex-1 overflow-hidden">
        <div className="flex items-center gap-2">
          <p className="text-xs font-medium text-primary-accent">
            Replying to {replyTo.sender.name}
          </p>
        </div>
        {replyTo.body && (
          <p className="mt-1 text-sm text-muted-foreground">{truncateText(replyTo.body, 100)}</p>
        )}
        {replyTo.image && !replyTo.body && (
          <p className="mt-1 text-sm italic text-muted-foreground">Image</p>
        )}
      </div>
      {showClose && onClose && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onClose()
          }}
          className="rounded-md text-muted-foreground/70 hover:text-foreground focus:outline-none"
        >
          <HiOutlineXMark size={20} />
        </button>
      )}
    </div>
  )
}

export default ReplyPreview
