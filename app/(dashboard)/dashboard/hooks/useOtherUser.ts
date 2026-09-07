import { useMemo } from "react"

import { useAppAuth } from "@/app/hooks/useAppAuth"

import { type FullConversationType, type UserSummary } from "../../../types"

const useOtherUser = (
  conversation: FullConversationType | { users: UserSummary[] }
): UserSummary | null => {
  const { user } = useAppAuth()

  const otherUser = useMemo(() => {
    // Matched by id, not email. Email is nullable on a participant, so two
    // accounts without one compared equal — and matching on it is why the safe
    // projection had to carry every account's address onto every conversation
    // channel.
    const currentUserId = user?.id

    const filtered = conversation.users.filter((u) => u.id !== currentUserId)

    return filtered[0] ?? null
  }, [conversation.users, user?.id])

  return otherUser
}

export default useOtherUser
