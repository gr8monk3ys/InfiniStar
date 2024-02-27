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
      className={`flex items-start gap-2 rounded-md border-l-4 border-sky-500 bg-gray-50 p-3 ${
        onClick ? "cursor-pointer hover:bg-gray-100" : ""
      }`}
    >
      <div className="flex-1 overflow-hidden">
        <div className="flex items-center gap-2">
          <p className="text-xs font-medium text-sky-600">Replying to {replyTo.sender.name}</p>
        </div>
        {replyTo.body && (
          <p className="mt-1 text-sm text-gray-600">{truncateText(replyTo.body, 100)}</p>
        )}
        {replyTo.image && !replyTo.body && (
          <p className="mt-1 text-sm italic text-gray-500">Image</p>
        )}
      </div>
      {showClose && onClose && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onClose()
          }}
          className="rounded-md text-gray-400 hover:text-gray-600 focus:outline-none"
        >
          <HiOutlineXMark size={20} />
        </button>
      )}
    </div>
  )
}

export default ReplyPreview
