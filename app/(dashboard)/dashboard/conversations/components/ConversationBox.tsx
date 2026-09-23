"use client"

import { memo, useMemo } from "react"
import Link from "next/link"
import clsx from "clsx"
import { isSameDay, isSameYear } from "date-fns"
import { BsPinAngleFill } from "react-icons/bs"
import { HiOutlineBellSlash } from "react-icons/hi2"

import { formatDate, formatDateTime, formatTime } from "@/app/lib/intl-format"
import useOtherUser from "@/app/(dashboard)/dashboard/hooks/useOtherUser"
import Avatar from "@/app/components/Avatar"
import AvatarGroup from "@/app/components/AvatarGroup"
import { TagBadge } from "@/app/components/tags"
import type { FullConversationType } from "@/app/types"

/**
 * Time for today, weekday within the last week, otherwise a short date so a
 * returning reader can tell "Tue" from "3 Sep" at a glance.
 */
export function formatConversationTimestamp(value: Date | string, now = new Date()): string {
  // Intl, not a hardcoded pattern, so the order and names follow the viewer's locale.
  const date = new Date(value)
  if (isSameDay(date, now)) return formatTime(date)
  const dayMs = 24 * 60 * 60 * 1000
  if (now.getTime() - date.getTime() < 6 * dayMs) return formatDate(date, { weekday: "short" })
  return isSameYear(date, now)
    ? formatDate(date, { day: "numeric", month: "short" })
    : formatDate(date, { day: "numeric", month: "short", year: "numeric" })
}

interface ConversationBoxProps {
  data: FullConversationType
  selected?: boolean
  /** Whether this conversation is selected via keyboard navigation */
  keyboardSelected?: boolean
  /** Passed from ConversationList to avoid a per-item Clerk subscription. */
  currentUserId?: string | null
}

const ConversationBox: React.FC<ConversationBoxProps> = ({
  data,
  selected,
  keyboardSelected,
  currentUserId,
}) => {
  const otherUser = useOtherUser(data)

  const lastMessage = useMemo(() => {
    const messages = data.messages || []

    return messages[messages.length - 1]
  }, [data.messages])

  const hasSeen = useMemo(() => {
    if (!lastMessage) {
      return false
    }

    const seenArray = lastMessage.seen || []

    if (!currentUserId) {
      return false
    }

    return seenArray.some((user) => user.id === currentUserId)
  }, [currentUserId, lastMessage])

  // Simple expressions with primitive results: computed inline, not memoized.
  const lastMessageText = lastMessage?.image
    ? "Sent an image"
    : lastMessage?.body || "Started a conversation"
  const isMuted = currentUserId ? data.mutedBy?.includes(currentUserId) || false : false
  const isPinned = currentUserId ? data.pinnedBy?.includes(currentUserId) || false : false
  const displayName = data.name || otherUser?.name

  return (
    // Navigation, so a real link (Cmd/Ctrl-click, middle-click, prefetch). Rows are
    // skipped by the browser while off-screen (up to 100 conversations).
    <Link
      href={`/dashboard/conversations/${data.id}`}
      className={clsx(
        `
        w-full
        relative
        flex
        items-center
        space-x-3
        p-3
        hover:bg-accent
        rounded-lg
        transition
        cursor-pointer
        [content-visibility:auto]
        [contain-intrinsic-size:auto_76px]
        focus-visible:outline-none
        focus-visible:ring-2
        focus-visible:ring-ring
        `,
        selected ? "bg-accent" : "bg-background",
        keyboardSelected && !selected && "ring-2 ring-ring ring-offset-1 ring-offset-background"
      )}
      aria-current={selected ? "page" : undefined}
    >
      {data.isGroup ? <AvatarGroup users={data.users} /> : <Avatar user={otherUser} />}
      <div className="min-w-0 flex-1">
        <div>
          <span className="absolute inset-0" aria-hidden="true" />
          <div className="mb-1 flex items-center justify-between">
            <div className="flex min-w-0 items-center gap-2">
              <p className="text-md truncate font-medium text-foreground">{displayName}</p>
              {isPinned && (
                <>
                  <BsPinAngleFill
                    size={14}
                    className="shrink-0 text-primary"
                    title="Pinned"
                    aria-hidden="true"
                  />
                  <span className="sr-only">(pinned)</span>
                </>
              )}
              {isMuted && (
                <>
                  <HiOutlineBellSlash
                    size={16}
                    className="shrink-0 text-muted-foreground"
                    title="Muted"
                    aria-hidden="true"
                  />
                  <span className="sr-only">(muted)</span>
                </>
              )}
            </div>
            {lastMessage?.createdAt && (
              // Formatted in the viewer's locale/time zone; the server's differs.
              <p
                className="shrink-0 text-xs font-light tabular-nums text-muted-foreground"
                title={formatDateTime(lastMessage.createdAt)}
                suppressHydrationWarning
              >
                {formatConversationTimestamp(lastMessage.createdAt)}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <p
              className={clsx(
                "flex-1 truncate text-sm",
                hasSeen ? "text-muted-foreground" : "text-foreground font-medium"
              )}
            >
              {lastMessageText}
            </p>
            {!hasSeen && lastMessage && (
              <>
                <span className="size-2 shrink-0 rounded-full bg-primary" aria-hidden="true" />
                <span className="sr-only">Unread</span>
              </>
            )}
          </div>
          {/* Display tags if any */}
          {data.tags && data.tags.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-1">
              {data.tags
                .slice(0, 3)
                .map((tag: { id: string; name: string; color: string | null }) => (
                  <TagBadge key={tag.id} tag={tag} size="sm" />
                ))}
              {data.tags.length > 3 && (
                <span className="rounded-full bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                  +{data.tags.length - 3}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </Link>
  )
}

export default memo(ConversationBox)
