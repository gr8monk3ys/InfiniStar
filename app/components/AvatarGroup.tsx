"use client"

import { memo, useMemo } from "react"
import Image from "next/image"

import type { UserSummary } from "@/app/types"

interface AvatarGroupProps {
  users: UserSummary[]
}

const POSITION_CLASSES = ["top-0 left-[12px]", "bottom-0", "bottom-0 right-0"] as const

const AvatarGroup: React.FC<AvatarGroupProps> = ({ users }) => {
  const slicedUsers = useMemo(() => users.slice(0, 3), [users])

  return (
    <div className="relative size-11">
      {slicedUsers.map((user, index) => (
        <div
          key={user.id}
          className={`
            absolute
            inline-block
            size-[21px]
            overflow-hidden
            rounded-full
            ${POSITION_CLASSES[index]}
          `}
        >
          <Image
            fill
            sizes="21px"
            src={user?.image || "/icon-192.png"}
            alt={user.name ? `${user.name}'s avatar` : "Participant avatar"}
            className="object-cover"
          />
        </div>
      ))}
    </div>
  )
}

export default memo(AvatarGroup)
