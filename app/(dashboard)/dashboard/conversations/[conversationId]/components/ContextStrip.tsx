"use client"

import Link from "next/link"
import { HiOutlineLightBulb, HiOutlineUserCircle } from "react-icons/hi2"

import { useMemories } from "@/app/hooks/useMemories"

interface ContextStripProps {
  /** Name of the persona the user is playing in this chat, if any */
  personaName?: string | null
}

const chipClass =
  "inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-card px-2.5 py-1 text-xs font-medium text-muted-foreground"

/**
 * ContextStrip - Slim row above the composer for character chats.
 *
 * Shows who the user is in the story (their persona) and how many memories
 * the character carries, linking the latter to the memory manager. Memories
 * are per user, so the count is the same across characters.
 */
export function ContextStrip({ personaName }: ContextStripProps) {
  const { capacity, isLoading } = useMemories()
  const memoryCount = capacity?.current ?? 0

  return (
    <div
      className="flex flex-wrap items-center gap-2 px-3 pt-2 sm:px-4"
      aria-label="Conversation context"
    >
      {personaName && (
        <span className={chipClass}>
          <HiOutlineUserCircle className="size-3.5" aria-hidden="true" />
          <span>
            You are <span className="text-foreground">{personaName}</span>
          </span>
        </span>
      )}
      <Link
        href="/dashboard/profile?tab=memory"
        className={`${chipClass} transition hover:border-primary/40 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2`}
        title="Open the memory manager"
      >
        <HiOutlineLightBulb className="size-3.5" aria-hidden="true" />
        <span>
          {isLoading ? "Memories" : memoryCount === 1 ? "1 memory" : `${memoryCount} memories`}
        </span>
      </Link>
    </div>
  )
}
