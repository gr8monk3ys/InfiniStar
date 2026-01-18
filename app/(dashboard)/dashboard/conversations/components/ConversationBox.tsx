"use client"

import { memo, useCallback, useMemo } from "react"
import { useRouter } from "next/navigation"
import clsx from "clsx"
import { format } from "date-fns"
import { useSession } from "next-auth/react"
import { HiOutlineBellSlash } from "react-icons/hi2"

import useOtherUser from "@/app/(dashboard)/dashboard/hooks/useOtherUser"
import Avatar from "@/app/components/Avatar"
import AvatarGroup from "@/app/components/AvatarGroup"
import type { FullConversationType } from "@/app/types"

interface ConversationBoxProps {
  data: FullConversationType
  selected?: boolean
}

const ConversationBox: React.FC<ConversationBoxProps> = ({ data, selected }) => {
  const otherUser = useOtherUser(data)
  const session = useSession()
  const router = useRouter()

  const handleClick = useCallback(() => {
    router.push(`/dashboard/conversations/${data.id}`)
  }, [data, router])

  const lastMessage = useMemo(() => {
    const messages = data.messages || []

    return messages[messages.length - 1]
  }, [data.messages])

  const userEmail = useMemo(() => session.data?.user?.email, [session.data?.user?.email])

  const hasSeen = useMemo(() => {
    if (!lastMessage) {
      return false
    }

    const seenArray = lastMessage.seen || []

    if (!userEmail) {
      return false
    }

    return seenArray.filter((user) => user.email === userEmail).length !== 0
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
    const currentUserId = session.data?.user?.id
    if (!currentUserId) return false
    return data.mutedBy?.includes(currentUserId) || false
  }, [data.mutedBy, session.data?.user?.id])

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
        hover:bg-neutral-100
        rounded-lg
        transition
        cursor-pointer
        `,
        selected ? "bg-neutral-100" : "bg-white"
      )}
    >
      {data.isGroup ? <AvatarGroup users={data.users} /> : <Avatar user={otherUser} />}
      <div className="min-w-0 flex-1">
        <div className="focus:outline-none">
          <span className="absolute inset-0" aria-hidden="true" />
          <div className="mb-1 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <p className="text-md font-medium text-gray-900">{data.name || otherUser.name}</p>
              {isMuted && <HiOutlineBellSlash size={16} className="text-gray-400" title="Muted" />}
            </div>
            {lastMessage?.createdAt && (
              <p
                className="
                  text-xs
                  font-light
                  text-gray-400
                "
              >
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
              hasSeen ? "text-gray-500" : "text-black font-medium"
            )}
          >
            {lastMessageText}
          </p>
        </div>
      </div>
    </div>
  )
}

export default memo(ConversationBox)
