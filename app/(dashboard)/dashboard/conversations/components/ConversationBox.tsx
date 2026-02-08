"use client"

import { memo, useCallback, useMemo } from "react"
import { useRouter } from "next/navigation"
import { useAuth, useUser } from "@clerk/nextjs"
import clsx from "clsx"
import { format } from "date-fns"
import { BsPinAngleFill } from "react-icons/bs"
import { HiOutlineBellSlash } from "react-icons/hi2"

import useOtherUser from "@/app/(dashboard)/dashboard/hooks/useOtherUser"
import Avatar from "@/app/components/Avatar"
import AvatarGroup from "@/app/components/AvatarGroup"
import { TagBadge } from "@/app/components/tags"
import type { FullConversationType } from "@/app/types"

interface ConversationBoxProps {
  data: FullConversationType
  selected?: boolean
  /** Whether this conversation is selected via keyboard navigation */
  keyboardSelected?: boolean
}

const ConversationBox: React.FC<ConversationBoxProps> = ({ data, selected, keyboardSelected }) => {
  const otherUser = useOtherUser(data)
  const { user } = useUser()
  const { userId } = useAuth()
  const router = useRouter()

  const handleClick = useCallback(() => {
    router.push(`/dashboard/conversations/${data.id}`)
  }, [data, router])

  const lastMessage = useMemo(() => {
    const messages = data.messages || []

    return messages[messages.length - 1]
  }, [data.messages])

  const userEmail = useMemo(() => user?.emailAddresses[0]?.emailAddress, [user?.emailAddresses])

  const hasSeen = useMemo(() => {
    if (!lastMessage) {
      return false
    }

    const seenArray = lastMessage.seen || []

    if (!userEmail) {
      return false
    }

    return (
      seenArray.filter((user: { email?: string | null }) => user.email === userEmail).length !== 0
    )
  }, [userEmail, lastMessage])

  const lastMessageText = useMemo(() => {
    if (lastMessage?.image) {
      return "Sent an image"
    }

    if (lastMessage?.body) {
      return lastMessage?.body
    }

    return "Started a conversation"
  }, [lastMessage])

  const isMuted = useMemo(() => {
    if (!userId) return false
    return data.mutedBy?.includes(userId) || false
  }, [data.mutedBy, userId])

  const isPinned = useMemo(() => {
    if (!userId) return false
    return data.pinnedBy?.includes(userId) || false
  }, [data.pinnedBy, userId])

  return (
    <div
      onClick={handleClick}
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
        `,
        selected ? "bg-accent" : "bg-background",
        keyboardSelected && !selected && "ring-2 ring-ring ring-offset-1 ring-offset-background"
      )}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          handleClick()
        }
      }}
      aria-label={`Open conversation with ${data.name || otherUser?.name}`}
    >
      {data.isGroup ? <AvatarGroup users={data.users} /> : <Avatar user={otherUser} />}
      <div className="min-w-0 flex-1">
        <div className="focus:outline-none">
          <span className="absolute inset-0" aria-hidden="true" />
          <div className="mb-1 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <p className="text-md font-medium text-foreground">{data.name || otherUser?.name}</p>
              {isPinned && (
                <BsPinAngleFill
                  size={14}
                  className="text-primary"
                  title="Pinned"
                  aria-label="Conversation pinned"
                />
              )}
              {isMuted && (
                <HiOutlineBellSlash
                  size={16}
                  className="text-muted-foreground"
                  title="Muted"
                  aria-label="Conversation muted"
                />
              )}
            </div>
            {lastMessage?.createdAt && (
              <p className="text-xs font-light text-muted-foreground">
                {format(new Date(lastMessage.createdAt), "p")}
              </p>
            )}
          </div>
          <p
            className={clsx(
              `
              truncate
              text-sm
              `,
              hasSeen ? "text-muted-foreground" : "text-foreground font-medium"
            )}
          >
            {lastMessageText}
          </p>
          {/* Display tags if any */}
          {data.tags && data.tags.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-1">
              {data.tags
                .slice(0, 3)
                .map((tag: { id: string; name: string; color: string | null }) => (
                  <TagBadge key={tag.id} tag={tag} size="sm" />
                ))}
              {data.tags.length > 3 && (
                <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                  +{data.tags.length - 3}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default memo(ConversationBox)
