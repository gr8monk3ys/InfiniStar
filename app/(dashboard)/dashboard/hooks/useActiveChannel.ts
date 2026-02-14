import { useEffect, useState } from "react"
import { type Channel, type Members } from "pusher-js"

import { pusherClient } from "@/app/lib/pusher"
import { PUSHER_PRESENCE_CHANNEL } from "@/app/lib/pusher-channels"

import useActiveList from "./useActiveList"

// Type for Pusher presence channel member
interface PusherMember {
  id: string
  info?: Record<string, unknown>
}

const useActiveChannel = (): void => {
  const { set, add, remove, updatePresence } = useActiveList()
  const [activeChannel, setActiveChannel] = useState<Channel | null>(null)

  useEffect(() => {
    let channel = activeChannel

    if (!channel) {
      channel = pusherClient.subscribe(PUSHER_PRESENCE_CHANNEL)
      setActiveChannel(channel)
    }

    channel.bind("pusher:subscription_succeeded", (members: Members) => {
      const initialMembers: string[] = []

      members.each((member: PusherMember) => initialMembers.push(member.id))
      set(initialMembers)
    })

    channel.bind("pusher:member_added", (member: PusherMember) => {
      add(member.id)
    })

    channel.bind("pusher:member_removed", (member: PusherMember) => {
      remove(member.id)
    })

    channel.bind(
      "user:presence",
      (data: {
        userId: string
        presenceStatus: string
        lastSeenAt?: string | null
        customStatus?: string | null
        customStatusEmoji?: string | null
      }) => {
        updatePresence({
          userId: data.userId,
          presenceStatus: data.presenceStatus,
          lastSeenAt: data.lastSeenAt ? new Date(data.lastSeenAt) : null,
          customStatus: data.customStatus,
          customStatusEmoji: data.customStatusEmoji,
        })
      }
    )

    return () => {
      if (activeChannel) {
        pusherClient.unsubscribe(PUSHER_PRESENCE_CHANNEL)
        setActiveChannel(null)
      }
    }
  }, [activeChannel, set, add, remove, updatePresence])
}

export default useActiveChannel
