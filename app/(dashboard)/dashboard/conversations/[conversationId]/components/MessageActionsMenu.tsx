"use client"

import { type RefObject } from "react"
import {
  HiEllipsisVertical,
  HiOutlineClipboardDocument,
  HiOutlineSquare2Stack,
  HiPencil,
  HiSpeakerWave,
  HiStopCircle,
  HiTrash,
} from "react-icons/hi2"

interface MessageActionsMenuProps {
  containerRef: RefObject<HTMLDivElement | null>
  open: boolean
  isDeleting?: boolean
  onToggle: () => void
  /** Own, editable messages */
  onEdit?: () => void
  onDelete?: () => void
  /** Any message with text */
  onCopy?: () => void
  /** AI conversations: branch a new conversation from this message */
  onBranch?: () => void
  isBranching?: boolean
  /** AI replies: read aloud via speech synthesis */
  onReadAloud?: () => void
  isSpeaking?: boolean
}

const itemClass =
  "flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-popover-foreground hover:bg-accent disabled:opacity-60"

/**
 * MessageActionsMenu - the "more" menu for a message.
 *
 * Holds the actions that are not needed on every line of dialogue (copy,
 * branch, read aloud, edit, delete) so the bubble row stays quiet. Renders
 * nothing when no action applies.
 */
export default function MessageActionsMenu({
  containerRef,
  open,
  isDeleting = false,
  onToggle,
  onEdit,
  onDelete,
  onCopy,
  onBranch,
  isBranching = false,
  onReadAloud,
  isSpeaking = false,
}: MessageActionsMenuProps) {
  const hasActions = Boolean(onEdit || onDelete || onCopy || onBranch || onReadAloud)
  if (!hasActions) return null

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={onToggle}
        className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        aria-label="More message actions"
        aria-expanded={open}
        title="More"
      >
        <HiEllipsisVertical size={16} aria-hidden="true" />
      </button>

      {open && (
        // A plain group of buttons (Tab-navigable) rather than role="menu", which
        // promises arrow-key navigation this popover does not implement.
        <div
          role="group"
          aria-label="Message actions"
          className="absolute right-0 z-10 mt-1 w-44 rounded-md border border-border bg-popover py-1 shadow-lg"
        >
          {onCopy && (
            <button type="button" onClick={onCopy} className={itemClass}>
              <HiOutlineClipboardDocument size={16} aria-hidden="true" />
              Copy Text
            </button>
          )}
          {onReadAloud && (
            <button type="button" onClick={onReadAloud} className={itemClass}>
              {isSpeaking ? (
                <HiStopCircle size={16} aria-hidden="true" />
              ) : (
                <HiSpeakerWave size={16} aria-hidden="true" />
              )}
              {isSpeaking ? "Stop Reading Aloud" : "Read Aloud"}
            </button>
          )}
          {onBranch && (
            <button
              type="button"

              onClick={onBranch}
              disabled={isBranching}
              className={itemClass}
            >
              <HiOutlineSquare2Stack size={16} aria-hidden="true" />
              {isBranching ? "Branching…" : "Branch from Here"}
            </button>
          )}
          {onEdit && (
            <button
              type="button"

              onClick={onEdit}
              className={itemClass}
              disabled={isDeleting}
            >
              <HiPencil size={16} aria-hidden="true" />
              Edit
            </button>
          )}
          {onDelete && (
            <button
              type="button"

              onClick={onDelete}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-destructive hover:bg-destructive/10 disabled:opacity-60"
              disabled={isDeleting}
            >
              <HiTrash size={16} aria-hidden="true" />
              {isDeleting ? "Deleting…" : "Delete"}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
