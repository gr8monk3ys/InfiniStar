import { useMemo } from "react"
import { useUser } from "@clerk/nextjs"
import { type User } from "@prisma/client"

import { type FullConversationType } from "../../../types"

const useOtherUser = (conversation: FullConversationType | { users: User[] }): User | null => {
  const { user } = useUser()

  const otherUser = useMemo(() => {
    const currentUserEmail = user?.emailAddresses[0]?.emailAddress

    const filtered = conversation.users.filter(
      (u: { email?: string | null }) => u.email !== currentUserEmail
    )

    return filtered[0] ?? null
  }, [user?.emailAddresses, conversation.users])

  return otherUser
}

export default useOtherUser
