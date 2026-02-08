import { useMemo } from "react"
import { useUser } from "@clerk/nextjs"
import { type User } from "@prisma/client"

import { type FullConversationType } from "../../../types"

const useOtherUser = (conversation: FullConversationType | { users: User[] }) => {
  const { user } = useUser()

  const otherUser = useMemo(() => {
    const currentUserEmail = user?.emailAddresses[0]?.emailAddress

    const otherUser = conversation.users.filter(
      (u: { email?: string | null }) => u.email !== currentUserEmail
    )

    return otherUser[0]
  }, [user?.emailAddresses, conversation.users])

  return otherUser
}

export default useOtherUser
