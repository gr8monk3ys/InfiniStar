import { useMemo } from "react"
import { useParams } from "next/navigation"

const useConversation = () => {
  const params = useParams()

  // Plain expressions: memoizing a primitive costs more than computing it.
  const conversationId = params?.conversationId ? (params.conversationId as string) : ""
  const isOpen = !!conversationId

  return useMemo(
    () => ({
      isOpen,
      conversationId,
    }),
    [isOpen, conversationId]
  )
}

export default useConversation
