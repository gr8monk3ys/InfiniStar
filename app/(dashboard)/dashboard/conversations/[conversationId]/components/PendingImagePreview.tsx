"use client"

import Image from "next/image"
import { HiXMark } from "react-icons/hi2"

export interface PendingImagePreviewProps {
  pendingImage: string
  onRemove: () => void
}

export function PendingImagePreview({ pendingImage, onRemove }: PendingImagePreviewProps) {
  return (
    <div className="mx-4 mt-2 flex items-start gap-3 rounded-lg border border-border/70 bg-muted/40 p-3">
      <Image
        src={pendingImage}
        alt="Pending prompt upload"
        width={56}
        height={56}
        className="size-14 rounded-md border border-border object-cover"
      />
      <div className="flex min-w-0 flex-1 items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">Image will be sent with your next prompt.</p>
        <button
          type="button"
          className="rounded-full p-1 text-muted-foreground transition hover:bg-accent hover:text-foreground"
          onClick={onRemove}
          aria-label="Remove pending image"
        >
          <HiXMark size={16} />
        </button>
      </div>
    </div>
  )
}
