"use client"

import { type RefObject } from "react"
import { HiEllipsisVertical, HiPencil, HiTrash } from "react-icons/hi2"

interface MessageActionsMenuProps {
  containerRef: RefObject<HTMLDivElement | null>
  open: boolean
  isDeleting: boolean
  onToggle: () => void
  onEdit: () => void
  onDelete: () => void
}

export default function MessageActionsMenu({
  containerRef,
  open,
  isDeleting,
  onToggle,
  onEdit,
  onDelete,
}: MessageActionsMenuProps) {
  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={onToggle}
        className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
        aria-label="Message options"
      >
        <HiEllipsisVertical size={16} />
      </button>

      {open && (
        <div className="absolute right-0 z-10 mt-1 w-32 rounded-md border border-border bg-popover shadow-lg">
          <button
            onClick={onEdit}
            className="flex w-full items-center gap-2 px-3 py-2 text-sm text-popover-foreground hover:bg-accent"
            disabled={isDeleting}
          >
            <HiPencil size={16} />
            Edit
          </button>
          <button
            onClick={onDelete}
            className="flex w-full items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-100 dark:hover:bg-red-900/20"
            disabled={isDeleting}
          >
            <HiTrash size={16} />
            {isDeleting ? "Deleting..." : "Delete"}
          </button>
        </div>
      )}
    </div>
  )
}
