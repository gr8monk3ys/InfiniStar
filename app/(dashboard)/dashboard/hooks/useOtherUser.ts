import { useMemo } from "react"
import { type User } from "@prisma/client"

import { useAppAuth } from "@/app/hooks/useAppAuth"

import { type FullConversationType } from "../../../types"

const useOtherUser = (conversation: FullConversationType | { users: User[] }): User | null => {
  const { user } = useAppAuth()

  const otherUser = useMemo(() => {
    const currentUserEmail = user?.email

    const filtered = conversation.users.filter(
      (u: { email?: string | null }) => u.email !== currentUserEmail
    )

    return filtered[0] ?? null
  }, [conversation.users, user?.email])

  return otherUser
}

export default useOtherUser
