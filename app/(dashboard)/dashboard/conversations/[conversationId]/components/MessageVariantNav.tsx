"use client"

import clsx from "clsx"
import { HiChevronLeft, HiChevronRight } from "react-icons/hi2"

interface MessageVariantNavProps {
  variantCount: number
  activeIndex: number
  disabled: boolean
  onSetVariant: (index: number) => Promise<void>
}

export default function MessageVariantNav({
  variantCount,
  activeIndex,
  disabled,
  onSetVariant,
}: MessageVariantNavProps) {
  return (
    <div
      className={clsx(
        "flex items-center gap-1 rounded-md border border-border bg-background/50 px-1 py-0.5",
        disabled && "opacity-60"
      )}
      aria-label="Alternative replies"
      title="Alternative replies"
    >
      <button
        type="button"
        onClick={() => {
          const prevIndex = activeIndex === 0 ? variantCount - 1 : activeIndex - 1
          onSetVariant(prevIndex).catch(() => {
            // handled in function
          })
        }}
        disabled={disabled}
        className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-50"
        aria-label="Previous reply variant"
      >
        <HiChevronLeft size={16} />
      </button>
      <span className="min-w-10 text-center text-xs text-muted-foreground">
        {activeIndex + 1}/{variantCount}
      </span>
      <button
        type="button"
        onClick={() => {
          const nextIndex = activeIndex === variantCount - 1 ? 0 : activeIndex + 1
          onSetVariant(nextIndex).catch(() => {
            // handled in function
          })
        }}
        disabled={disabled}
        className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-50"
        aria-label="Next reply variant"
      >
        <HiChevronRight size={16} />
      </button>
    </div>
  )
}
