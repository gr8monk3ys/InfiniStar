import { useMemo } from "react"

import { useAppAuth } from "@/app/hooks/useAppAuth"

import { type FullConversationType, type UserSummary } from "../../../types"

const useOtherUser = (
  conversation: FullConversationType | { users: UserSummary[] }
): UserSummary | null => {
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
