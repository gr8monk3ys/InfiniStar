import { memo, type FC } from "react"
import Image from "next/image"
import type { User } from "@prisma/client"

import useActiveList from "@/app/(dashboard)/dashboard/hooks/useActiveList"

interface AvatarProps {
  user?: User
  className?: string
  showPresence?: boolean
}

const Avatar: FC<AvatarProps> = ({ user, className, showPresence = true }) => {
  const { members, getPresence } = useActiveList()

  const altText = user?.name
    ? `${user.name}'s profile picture`
    : user?.email
      ? `${user.email}'s profile picture`
      : "User profile picture"

  // Get presence status
  const presence = user?.id ? getPresence(user.id) : null
  const isOnline = members.indexOf(user?.id!) !== -1
  const presenceStatus = presence?.presenceStatus || (isOnline ? "online" : "offline")

  // Determine presence indicator color
  const getPresenceColor = () => {
    switch (presenceStatus) {
      case "online":
        return "bg-green-500"
      case "away":
        return "bg-yellow-500"
      case "offline":
      default:
        return "bg-gray-400"
    }
  }

  return (
    <div className={`relative size-11 overflow-hidden rounded-full ${className}`}>
      <Image
        fill
        sizes="44px"
        src={user?.image || "/placeholder.jpg"}
        alt={altText}
        className="object-cover"
      />
      {showPresence && user && (
        <span
          className={`absolute bottom-0 right-0 block size-3 rounded-full ring-2 ring-white ${getPresenceColor()}`}
          title={presenceStatus.charAt(0).toUpperCase() + presenceStatus.slice(1)}
          aria-label={`${presenceStatus} status`}
        />
      )}
    </div>
  )
}

export default memo(Avatar)
