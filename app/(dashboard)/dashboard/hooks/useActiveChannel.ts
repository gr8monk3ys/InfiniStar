import { useEffect, useState } from "react"
import { type Channel, type Members } from "pusher-js"

import { pusherClient } from "@/app/lib/pusher"

import useActiveList from "./useActiveList"

// Type for Pusher presence channel member
interface PusherMember {
  id: string
  info?: Record<string, unknown>
}

const useActiveChannel = (): void => {
  const { set, add, remove } = useActiveList()
  const [activeChannel, setActiveChannel] = useState<Channel | null>(null)

  useEffect(() => {
    let channel = activeChannel

    if (!channel) {
      channel = pusherClient.subscribe("presence-messenger")
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

    return () => {
      if (activeChannel) {
        pusherClient.unsubscribe("presence-messenger")
        setActiveChannel(null)
      }
    }
  }, [activeChannel, set, add, remove])
}

export default useActiveChannel
