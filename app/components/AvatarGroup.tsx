"use client"

import { memo, useMemo } from "react"
import Image from "next/image"
import type { User } from "@prisma/client"

interface AvatarGroupProps {
  users: User[]
}

const AvatarGroup: React.FC<AvatarGroupProps> = ({ users = [] }) => {
  const slicedUsers = useMemo(() => users.slice(0, 3), [users])

  const positionMap = {
    0: "top-0 left-[12px]",
    1: "bottom-0",
    2: "bottom-0 right-0",
  }

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
            ${positionMap[index as keyof typeof positionMap]}
          `}
        >
          <Image
            fill
            sizes="21px"
            src={user?.image || "/placeholder.jpg"}
            alt={`${user.name}'s avatar`}
            className="object-cover"
          />
        </div>
      ))}
    </div>
  )
}

export default memo(AvatarGroup)
