"use client"

import Image from "next/image"
import Link from "next/link"

import { characterPortrait } from "@/app/lib/character-portrait"
import { cn } from "@/app/lib/utils"
import type { RecentCharacterChat } from "@/app/actions/getRecentCharacterChats"

/**
 * The way back into a conversation you are already in.
 *
 * Explore was a wall of strangers whether you had been here five minutes or
 * five months, which pulls against PRODUCT.md's first principle — "every
 * surface should make it easy to return to an existing character, not just
 * start a new one". A returning chatter's most valuable object on this page is
 * the conversation they left, and it was not on it.
 *
 * Renders nothing for a visitor with no history, which includes every
 * logged-out visitor, so the page is unchanged for a first impression.
 */

interface ContinueChattingRailProps {
  chats: RecentCharacterChat[]
}

/** "yesterday", "4 days ago" — the resolution a person actually thinks in. */
function describeLastVisit(at: Date): string {
  const days = Math.floor((Date.now() - new Date(at).getTime()) / 86_400_000)
  if (days <= 0) return "today"
  if (days === 1) return "yesterday"
  if (days < 7) return `${days} days ago`
  if (days < 14) return "last week"
  if (days < 60) return `${Math.floor(days / 7)} weeks ago`
  return `${Math.floor(days / 30)} months ago`
}

export function ContinueChattingRail({ chats }: ContinueChattingRailProps) {
  if (chats.length === 0) return null

  return (
    <section aria-labelledby="continue-chatting-heading">
      <h2
        id="continue-chatting-heading"
        className="text-xs font-medium uppercase tracking-wider text-primary-accent"
      >
        Pick up where you left off
      </h2>

      {/*
        Bleeds past the container on small screens so a half-visible pill reads
        as "there is more", which a row that stops at the padding never does.
      */}
      <div className="-mx-4 mt-3 overflow-x-auto px-4 pb-1 md:mx-0 md:px-0">
        <ul className="flex w-max gap-2 md:w-auto md:flex-wrap">
          {chats.map((chat) => {
            const portrait = characterPortrait(chat)
            return (
              <li key={chat.conversationId} className="shrink-0">
                <Link
                  href={`/dashboard/conversations/${chat.conversationId}`}
                  className={cn(
                    "flex items-center gap-2.5 rounded-full border border-border/50 bg-card py-1.5 pl-1.5 pr-4",
                    "transition-colors hover:border-primary/40",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                  )}
                >
                  <span className="relative size-8 overflow-hidden rounded-full">
                    {chat.avatarUrl ? (
                      <Image
                        src={chat.avatarUrl}
                        alt=""
                        fill
                        className="object-cover"
                        sizes="32px"
                      />
                    ) : (
                      <span
                        className="flex h-full w-full items-center justify-center text-xs font-bold text-white/90"
                        style={{ backgroundImage: portrait.backgroundImage }}
                        aria-hidden="true"
                      >
                        {portrait.initial}
                      </span>
                    )}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold leading-tight">
                      {chat.name}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {describeLastVisit(chat.lastMessageAt)} &middot; {chat.messageCount}{" "}
                      {chat.messageCount === 1 ? "message" : "messages"}
                    </span>
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
      </div>
    </section>
  )
}
