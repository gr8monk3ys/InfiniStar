"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { type User } from "@prisma/client"
import clsx from "clsx"
import { useSession } from "next-auth/react"
import { HiArchiveBox, HiArchiveBoxXMark, HiMagnifyingGlass, HiSparkles } from "react-icons/hi2"
import { MdOutlineGroupAdd } from "react-icons/md"

import { pusherClient } from "@/app/lib/pusher"
import useActiveList from "@/app/(dashboard)/dashboard/hooks/useActiveList"
import useConversation from "@/app/(dashboard)/dashboard/hooks/useConversation"
import GroupChatModal from "@/app/components/modals/GroupChatModal"
import PersonalitySelectionModal from "@/app/components/modals/PersonalitySelectionModal"
import SearchModal from "@/app/components/modals/SearchModal"
import { type FullConversationType } from "@/app/types"

import ConversationBox from "./ConversationBox"

interface ConversationListProps {
  initialItems: FullConversationType[]
  user: User[]
  title?: string
}

const ConversationList: React.FC<ConversationListProps> = ({ initialItems, user }) => {
  const [items, setItems] = useState(initialItems)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isPersonalityModalOpen, setIsPersonalityModalOpen] = useState(false)
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false)
  const [showArchived, setShowArchived] = useState(false)

  const router = useRouter()
  const session = useSession()

  const { conversationId, isOpen } = useConversation()

  const pusherKey = useMemo(() => {
    return session.data?.user?.email
  }, [session.data?.user?.email])

  const currentUserId = useMemo(() => {
    return session.data?.user?.id
  }, [session.data?.user?.id])

  // Filter and sort conversations based on archive and pin status
  const filteredItems = useMemo(() => {
    if (!currentUserId) return items

    // Filter by archive status
    const filtered = items.filter((item) => {
      const isArchived = item.archivedBy?.includes(currentUserId) || false
      return showArchived ? isArchived : !isArchived
    })

    // Sort: pinned conversations first, then by lastMessageAt
    return filtered.sort((a, b) => {
      const aIsPinned = a.pinnedBy?.includes(currentUserId) || false
      const bIsPinned = b.pinnedBy?.includes(currentUserId) || false

      // If both pinned or both unpinned, sort by lastMessageAt
      if (aIsPinned === bIsPinned) {
        return new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime()
      }

      // Pinned conversations come first
      return aIsPinned ? -1 : 1
    })
  }, [items, currentUserId, showArchived])

  // Count archived conversations
  const archivedCount = useMemo(() => {
    if (!currentUserId) return 0
    return items.filter((item) => item.archivedBy?.includes(currentUserId)).length
  }, [items, currentUserId])

  useEffect(() => {
    if (!pusherKey || !currentUserId) {
      return
    }

    // Subscribe to user-specific channel for personal updates (archive/unarchive)
    const userChannel = `user-${currentUserId}`
    pusherClient.subscribe(pusherKey)
    pusherClient.subscribe(userChannel)

    const updateHandler = (conversation: FullConversationType) => {
      setItems((current) =>
        current.map((currentConversation) => {
          if (currentConversation.id === conversation.id) {
            return {
              ...currentConversation,
              messages: conversation.messages,
            }
          }

          return currentConversation
        })
      )
    }

    const newHandler = (conversation: FullConversationType) => {
      setItems((current) => {
        // Use native array method instead of lodash find
        if (current.some((c) => c.id === conversation.id)) {
          return current
        }

        return [conversation, ...current]
      })
    }

    const removeHandler = (conversation: FullConversationType) => {
      setItems((current) => {
        return [...current.filter((convo) => convo.id !== conversation.id)]
      })
    }

    const archiveHandler = (conversation: FullConversationType) => {
      setItems((current) =>
        current.map((currentConversation) => {
          if (currentConversation.id === conversation.id) {
            return {
              ...currentConversation,
              archivedBy: conversation.archivedBy,
              archivedAt: conversation.archivedAt,
            }
          }
          return currentConversation
        })
      )
    }

    const unarchiveHandler = (conversation: FullConversationType) => {
      setItems((current) =>
        current.map((currentConversation) => {
          if (currentConversation.id === conversation.id) {
            return {
              ...currentConversation,
              archivedBy: conversation.archivedBy,
              archivedAt: conversation.archivedAt,
            }
          }
          return currentConversation
        })
      )
    }

    const pinHandler = (conversation: FullConversationType) => {
      setItems((current) =>
        current.map((currentConversation) => {
          if (currentConversation.id === conversation.id) {
            return {
              ...currentConversation,
              pinnedBy: conversation.pinnedBy,
              pinnedAt: conversation.pinnedAt,
            }
          }
          return currentConversation
        })
      )
    }

    const unpinHandler = (conversation: FullConversationType) => {
      setItems((current) =>
        current.map((currentConversation) => {
          if (currentConversation.id === conversation.id) {
            return {
              ...currentConversation,
              pinnedBy: conversation.pinnedBy,
              pinnedAt: conversation.pinnedAt,
            }
          }
          return currentConversation
        })
      )
    }

    const muteHandler = (conversation: FullConversationType) => {
      setItems((current) =>
        current.map((currentConversation) => {
          if (currentConversation.id === conversation.id) {
            return {
              ...currentConversation,
              mutedBy: conversation.mutedBy,
              mutedAt: conversation.mutedAt,
            }
          }
          return currentConversation
        })
      )
    }

    const unmuteHandler = (conversation: FullConversationType) => {
      setItems((current) =>
        current.map((currentConversation) => {
          if (currentConversation.id === conversation.id) {
            return {
              ...currentConversation,
              mutedBy: conversation.mutedBy,
              mutedAt: conversation.mutedAt,
            }
          }
          return currentConversation
        })
      )
    }

    const presenceHandler = (data: {
      userId: string
      presenceStatus: string
      lastSeenAt?: string | null
      customStatus?: string | null
      customStatusEmoji?: string | null
    }) => {
      // Update presence in the active list store
      const { updatePresence } = useActiveList.getState()
      updatePresence({
        userId: data.userId,
        presenceStatus: data.presenceStatus,
        lastSeenAt: data.lastSeenAt ? new Date(data.lastSeenAt) : null,
        customStatus: data.customStatus,
        customStatusEmoji: data.customStatusEmoji,
      })
    }

    pusherClient.bind("conversation:update", updateHandler)
    pusherClient.bind("conversation:new", newHandler)
    pusherClient.bind("conversation:remove", removeHandler)
    pusherClient.bind("conversation:archive", archiveHandler)
    pusherClient.bind("conversation:unarchive", unarchiveHandler)
    pusherClient.bind("conversation:pin", pinHandler)
    pusherClient.bind("conversation:unpin", unpinHandler)
    pusherClient.bind("conversation:mute", muteHandler)
    pusherClient.bind("conversation:unmute", unmuteHandler)
    pusherClient.bind("user:presence", presenceHandler)

    return () => {
      // Unsubscribe from both channels
      if (pusherKey) {
        pusherClient.unsubscribe(pusherKey)
      }
      pusherClient.unsubscribe(userChannel)

      // Unbind all event handlers to prevent memory leaks
      pusherClient.unbind("conversation:update", updateHandler)
      pusherClient.unbind("conversation:new", newHandler)
      pusherClient.unbind("conversation:remove", removeHandler)
      pusherClient.unbind("conversation:archive", archiveHandler)
      pusherClient.unbind("conversation:unarchive", unarchiveHandler)
      pusherClient.unbind("conversation:pin", pinHandler)
      pusherClient.unbind("conversation:unpin", unpinHandler)
      pusherClient.unbind("conversation:mute", muteHandler)
      pusherClient.unbind("conversation:unmute", unmuteHandler)
      pusherClient.unbind("user:presence", presenceHandler)
    }
  }, [pusherKey, currentUserId, router])

  return (
    <>
      <GroupChatModal user={user} isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
      <PersonalitySelectionModal
        isOpen={isPersonalityModalOpen}
        onClose={() => setIsPersonalityModalOpen(false)}
      />
      <SearchModal isOpen={isSearchModalOpen} onClose={() => setIsSearchModalOpen(false)} />
      <aside
        className={clsx(
          `
        fixed
        inset-y-0
        pb-20
        lg:pb-0
        lg:left-20
        lg:w-80
        lg:block
        overflow-y-auto
        border-r
        border-gray-200
      `,
          isOpen ? "hidden" : "block w-full left-0"
        )}
      >
        <div className="px-5">
          <div className="mb-4 flex justify-between pt-4">
            <div className="text-2xl font-bold text-neutral-800">
              {showArchived ? "Archived" : "Messages"}
            </div>
            <div className="flex gap-2">
              <div
                onClick={() => setIsSearchModalOpen(true)}
                className="
                  cursor-pointer
                  rounded-full
                  bg-gray-100
                  p-2
                  text-gray-600
                  transition
                  hover:opacity-75
                "
                title="Search Messages"
              >
                <HiMagnifyingGlass size={20} />
              </div>
              <div
                onClick={() => setIsPersonalityModalOpen(true)}
                className="
                  cursor-pointer
                  rounded-full
                  bg-gradient-to-r from-purple-500 to-pink-500
                  p-2
                  text-white
                  transition
                  hover:opacity-75
                "
                title="New AI Chat"
              >
                <HiSparkles size={20} />
              </div>
              <div
                onClick={() => setIsModalOpen(true)}
                className="
                  cursor-pointer
                  rounded-full
                  bg-gray-100
                  p-2
                  text-gray-600
                  transition
                  hover:opacity-75
                "
                title="New Group Chat"
              >
                <MdOutlineGroupAdd size={20} />
              </div>
            </div>
          </div>

          {/* Archive toggle button */}
          {archivedCount > 0 && (
            <button
              onClick={() => setShowArchived(!showArchived)}
              className="mb-4 flex w-full items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-4 py-2 text-sm text-gray-700 transition hover:bg-gray-100"
            >
              <div className="flex items-center gap-2">
                {showArchived ? <HiArchiveBoxXMark size={18} /> : <HiArchiveBox size={18} />}
                <span>{showArchived ? "Show Active" : "Show Archived"}</span>
              </div>
              {!showArchived && archivedCount > 0 && (
                <span className="rounded-full bg-gray-300 px-2 py-0.5 text-xs font-medium text-gray-700">
                  {archivedCount}
                </span>
              )}
            </button>
          )}

          {filteredItems.length === 0 ? (
            <div className="mt-8 text-center text-sm text-gray-500">
              {showArchived ? "No archived conversations" : "No active conversations"}
            </div>
          ) : (
            filteredItems.map((item) => (
              <ConversationBox key={item.id} data={item} selected={conversationId === item.id} />
            ))
          )}
        </div>
      </aside>
    </>
  )
}

export default ConversationList
