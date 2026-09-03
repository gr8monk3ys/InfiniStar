"use client"

import { type RefObject } from "react"
import { HiFaceSmile } from "react-icons/hi2"

const commonEmojis = ["👍", "❤️", "😄", "🎉", "🔥", "👏"]

interface MessageReactionPickerProps {
  containerRef: RefObject<HTMLDivElement | null>
  open: boolean
  onToggle: () => void
  onReact: (emoji: string) => Promise<void>
}

export default function MessageReactionPicker({
  containerRef,
  open,
  onToggle,
  onReact,
}: MessageReactionPickerProps) {
  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={onToggle}
        className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        aria-label="Add reaction"
        aria-expanded={open}
        aria-haspopup="true"
      >
        <HiFaceSmile size={16} />
      </button>

      {open && (
        <div
          className="absolute left-0 z-10 mt-1 flex gap-1 rounded-md border border-border bg-popover p-2 shadow-lg"
          role="toolbar"
          aria-label="Message reactions"
        >
          {commonEmojis.map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() => onReact(emoji)}
              className="rounded p-1 text-xl hover:bg-accent"
              aria-label={`React with ${emoji}`}
              title={`React with ${emoji}`}
            >
              {emoji}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
