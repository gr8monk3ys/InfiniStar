"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import dynamic from "next/dynamic"
import { useRouter } from "next/navigation"
import { type User } from "@prisma/client"
import clsx from "clsx"
import { BsPinAngleFill } from "react-icons/bs"
import {
  HiArchiveBox,
  HiArchiveBoxXMark,
  HiChatBubbleLeftRight,
  HiMagnifyingGlass,
  HiOutlineTag,
  HiSparkles,
  HiXMark,
} from "react-icons/hi2"
import { MdOutlineGroupAdd } from "react-icons/md"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/app/components/ui/dropdown-menu"
import { useGlobalSearchContext } from "@/app/(dashboard)/dashboard/components/GlobalSearchProvider"
import { useKeyboardShortcutsContext } from "@/app/(dashboard)/dashboard/components/KeyboardShortcutsProvider"
import useConversation from "@/app/(dashboard)/dashboard/hooks/useConversation"
import { usePusherConversationSync } from "@/app/(dashboard)/dashboard/hooks/usePusherConversationSync"
import { TagBadge } from "@/app/components/tags"
import { useTags } from "@/app/hooks/useTags"
import { TAG_COLORS, type FullConversationType, type TagColor } from "@/app/types"

import ConversationBox from "./ConversationBox"

// Lazy-load modals that are only shown on user interaction
const GroupChatModal = dynamic(() => import("@/app/components/modals/GroupChatModal"), {
  ssr: false,
  loading: () => null,
})

const PersonalitySelectionModal = dynamic(
  () => import("@/app/components/modals/PersonalitySelectionModal"),
  {
    ssr: false,
    loading: () => null,
  }
)

const SceneChatModal = dynamic(() => import("@/app/components/modals/SceneChatModal"), {
  ssr: false,
  loading: () => null,
})

interface ConversationListProps {
  initialItems: FullConversationType[]
  user: User[]
  currentUserId: string | null
  title?: string
}

interface NotificationPreferences {
  browserNotifications: boolean
  notifyOnNewMessage: boolean
  notifyOnAIComplete: boolean
  mutedConversations: string[]
}

const ConversationList: React.FC<ConversationListProps> = ({
  initialItems,
  user,
  currentUserId,
}) => {
  const [items, setItems] = useState(initialItems)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isPersonalityModalOpen, setIsPersonalityModalOpen] = useState(false)
  const [isSceneModalOpen, setIsSceneModalOpen] = useState(false)
  const [showArchived, setShowArchived] = useState(false)
  const [selectedTagId, setSelectedTagId] = useState<string | null>(null)
  const [notificationPrefs, setNotificationPrefs] = useState<NotificationPreferences | null>(null)

  // Fetch user's tags for filtering
  const { tags: userTags } = useTags()

  // Use global search context for the search modal
  const { open: openSearch } = useGlobalSearchContext()

  // Use keyboard shortcuts context for navigation
  const { selectedConversationIndex, setSelectedConversationIndex, setOpenNewAIConversation } =
    useKeyboardShortcutsContext()

  const router = useRouter()

  const { conversationId, isOpen } = useConversation()

  useEffect(() => {
    if (!currentUserId) {
      setNotificationPrefs(null)
      return
    }

    let cancelled = false

    const fetchPreferences = async () => {
      try {
        const response = await fetch("/api/notifications/preferences")
        if (!response.ok) {
          setNotificationPrefs(null)
          return
        }

        const data = (await response.json()) as {
          preferences?: {
            browserNotifications?: boolean
            notifyOnNewMessage?: boolean
            notifyOnAIComplete?: boolean
            mutedConversations?: string[]
          }
        }

        const prefs = data.preferences
        if (!prefs) return

        if (!cancelled) {
          setNotificationPrefs({
            browserNotifications: Boolean(prefs.browserNotifications),
            notifyOnNewMessage: Boolean(prefs.notifyOnNewMessage),
            notifyOnAIComplete: Boolean(prefs.notifyOnAIComplete),
            mutedConversations: Array.isArray(prefs.mutedConversations)
              ? prefs.mutedConversations
              : [],
          })
        }
      } catch {
        if (!cancelled) {
          setNotificationPrefs(null)
        }
      }
    }

    fetchPreferences().catch(() => {
      // ignore
    })

    const handleFocus = () => {
      fetchPreferences().catch(() => {
        // ignore
      })
    }

    window.addEventListener("focus", handleFocus)
    return () => {
      cancelled = true
      window.removeEventListener("focus", handleFocus)
    }
  }, [currentUserId])

  // Subscribe to Pusher user channel for real-time conversation updates
  usePusherConversationSync({ currentUserId, items, setItems, notificationPrefs })

  // Derive the current user's email once so we can pass it to ConversationBox
  // for accurate hasSeen calculation without per-item Clerk subscriptions.
  const currentUserEmail = useMemo(() => {
    if (!currentUserId) return null
    return user.find((u) => u.id === currentUserId)?.email ?? null
  }, [currentUserId, user])

  // Filter and sort conversations based on archive, pin, and tag status
  const filteredItems = useMemo(() => {
    if (!currentUserId) return items

    // Filter by archive status and tag
    const filtered = items.filter((item) => {
      const isArchived = item.archivedBy?.includes(currentUserId) || false
      const archiveMatch = showArchived ? isArchived : !isArchived

      // Filter by tag if one is selected
      let tagMatch = true
      if (selectedTagId) {
        tagMatch = item.tags?.some((tag: { id: string }) => tag.id === selectedTagId) || false
      }

      return archiveMatch && tagMatch
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
  }, [items, currentUserId, showArchived, selectedTagId])

  // Get the selected tag object for display
  const selectedTag = useMemo(() => {
    if (!selectedTagId) return null
    return userTags.find((t) => t.id === selectedTagId) || null
  }, [selectedTagId, userTags])

  // Count archived conversations
  const archivedCount = useMemo(() => {
    if (!currentUserId) return 0
    return items.filter((item) => item.archivedBy?.includes(currentUserId)).length
  }, [items, currentUserId])

  // Separate pinned and unpinned conversations
  const { pinnedItems, unpinnedItems } = useMemo(() => {
    if (!currentUserId) return { pinnedItems: [], unpinnedItems: filteredItems }

    const pinned = filteredItems.filter((item) => item.pinnedBy?.includes(currentUserId))
    const unpinned = filteredItems.filter((item) => !item.pinnedBy?.includes(currentUserId))

    return { pinnedItems: pinned, unpinnedItems: unpinned }
  }, [filteredItems, currentUserId])

  // Register the open new AI conversation callback
  const openNewAIConversationHandler = useCallback(() => {
    setIsPersonalityModalOpen(true)
  }, [])

  useEffect(() => {
    setOpenNewAIConversation(openNewAIConversationHandler)
  }, [setOpenNewAIConversation, openNewAIConversationHandler])

  // Handle keyboard navigation - navigate to conversation when Enter is pressed
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      // Only handle Enter key when a conversation is selected
      if (event.key === "Enter" && selectedConversationIndex >= 0) {
        const targetConversation = filteredItems[selectedConversationIndex]
        if (targetConversation) {
          event.preventDefault()
          router.push(`/dashboard/conversations/${targetConversation.id}`)
        }
      }
    }

    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [selectedConversationIndex, filteredItems, router])

  // Clamp selected index when conversations list changes
  useEffect(() => {
    if (selectedConversationIndex >= filteredItems.length) {
      setSelectedConversationIndex(Math.max(0, filteredItems.length - 1))
    }
  }, [filteredItems.length, selectedConversationIndex, setSelectedConversationIndex])

  return (
    <>
      {isModalOpen && (
        <GroupChatModal user={user} isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
      )}
      {isPersonalityModalOpen && (
        <PersonalitySelectionModal
          isOpen={isPersonalityModalOpen}
          onClose={() => setIsPersonalityModalOpen(false)}
        />
      )}
      {isSceneModalOpen && (
        <SceneChatModal isOpen={isSceneModalOpen} onClose={() => setIsSceneModalOpen(false)} />
      )}
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
        border-border
        bg-background
      `,
          isOpen ? "hidden" : "block w-full left-0"
        )}
      >
        <div className="px-5">
          <div className="mb-4 flex justify-between pt-4">
            <div className="text-2xl font-bold text-foreground">
              {showArchived ? "Archived" : "Messages"}
            </div>
            <div className="flex gap-2">
              <button
                onClick={openSearch}
                className="
                  cursor-pointer
                  rounded-full
                  bg-secondary
                  p-2
                  text-secondary-foreground
                  transition
                  hover:opacity-75
                "
                title="Search (Cmd+K)"
                aria-label="Search conversations and messages (Cmd+K or Ctrl+K)"
              >
                <HiMagnifyingGlass size={20} />
              </button>
              <button
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
                aria-label="Start new AI Chat"
              >
                <HiSparkles size={20} />
              </button>
              <button
                onClick={() => setIsSceneModalOpen(true)}
                className="
                  cursor-pointer
                  rounded-full
                  bg-secondary
                  p-2
                  text-secondary-foreground
                  transition
                  hover:opacity-75
                "
                title="New Scene Chat"
                aria-label="Create new Scene Chat"
              >
                <HiChatBubbleLeftRight size={20} />
              </button>
              <button
                onClick={() => setIsModalOpen(true)}
                className="
                  cursor-pointer
                  rounded-full
                  bg-secondary
                  p-2
                  text-secondary-foreground
                  transition
                  hover:opacity-75
                "
                title="New Group Chat"
                aria-label="Create new Group Chat"
              >
                <MdOutlineGroupAdd size={20} />
              </button>
            </div>
          </div>

          {/* Archive toggle button */}
          {archivedCount > 0 && (
            <button
              onClick={() => setShowArchived(!showArchived)}
              className="mb-4 flex w-full items-center justify-between rounded-lg border border-border bg-secondary px-4 py-2 text-sm text-secondary-foreground transition hover:bg-accent"
              aria-label={
                showArchived ? "Show active conversations" : "Show archived conversations"
              }
            >
              <div className="flex items-center gap-2">
                {showArchived ? <HiArchiveBoxXMark size={18} /> : <HiArchiveBox size={18} />}
                <span>{showArchived ? "Show Active" : "Show Archived"}</span>
              </div>
              {!showArchived && archivedCount > 0 && (
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                  {archivedCount}
                </span>
              )}
            </button>
          )}

          {/* Tag filter */}
          {userTags.length > 0 && (
            <div className="mb-4">
              {/* Show selected tag or filter button */}
              {selectedTag ? (
                <div className="flex items-center justify-between rounded-lg border border-border bg-secondary px-3 py-2">
                  <div className="flex items-center gap-2 text-sm">
                    <HiOutlineTag size={16} className="text-muted-foreground" />
                    <span className="text-muted-foreground">Filtering by:</span>
                    <TagBadge tag={selectedTag} size="sm" />
                  </div>
                  <button
                    onClick={() => setSelectedTagId(null)}
                    className="rounded-full p-1 text-muted-foreground transition hover:bg-accent hover:text-foreground"
                    aria-label="Clear tag filter"
                    title="Clear filter"
                  >
                    <HiXMark size={16} />
                  </button>
                </div>
              ) : (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className="flex w-full items-center justify-between rounded-lg border border-border bg-secondary px-4 py-2 text-sm text-secondary-foreground transition hover:bg-accent"
                      aria-label="Filter by tag"
                    >
                      <div className="flex items-center gap-2">
                        <HiOutlineTag size={18} />
                        <span>Filter by Tag</span>
                      </div>
                      <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                        {userTags.length}
                      </span>
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuLabel>Filter by tag</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onSelect={() => setSelectedTagId(null)}
                      className={!selectedTagId ? "font-medium" : ""}
                    >
                      All conversations
                    </DropdownMenuItem>
                    {userTags.map((tag) => {
                      const colorScheme = TAG_COLORS[tag.color as TagColor] || TAG_COLORS.gray
                      return (
                        <DropdownMenuItem
                          key={tag.id}
                          onSelect={() => setSelectedTagId(tag.id)}
                          className={selectedTagId === tag.id ? "font-medium" : ""}
                        >
                          <span
                            className={clsx(
                              "mr-2 size-3 shrink-0 rounded-full border",
                              colorScheme.bg,
                              colorScheme.border
                            )}
                          />
                          <span className="truncate">{tag.name}</span>
                          <span className="ml-auto text-xs text-muted-foreground">
                            {tag.conversationCount}
                          </span>
                        </DropdownMenuItem>
                      )
                    })}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          )}

          {filteredItems.length === 0 ? (
            <div className="mt-8 text-center text-sm text-muted-foreground">
              {selectedTagId
                ? `No conversations with this tag${showArchived ? " in archived" : ""}`
                : showArchived
                  ? "No archived conversations"
                  : "No active conversations"}
            </div>
          ) : (
            <>
              {/* Pinned conversations section */}
              {pinnedItems.length > 0 && (
                <div className="mb-2">
                  <div className="mb-2 flex items-center gap-2 px-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    <BsPinAngleFill size={12} className="text-primary" />
                    <span>Pinned</span>
                    <span className="text-xs text-muted-foreground">({pinnedItems.length}/5)</span>
                  </div>
                  {pinnedItems.map((item, index) => (
                    <ConversationBox
                      key={item.id}
                      data={item}
                      selected={conversationId === item.id}
                      keyboardSelected={selectedConversationIndex === index}
                      currentUserId={currentUserId}
                      currentUserEmail={currentUserEmail}
                    />
                  ))}
                </div>
              )}

              {/* Regular conversations section */}
              {unpinnedItems.length > 0 && (
                <div>
                  {pinnedItems.length > 0 && (
                    <div className="mb-2 mt-4 px-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      All Conversations
                    </div>
                  )}
                  {unpinnedItems.map((item, index) => {
                    // Account for pinned items in the index calculation
                    const absoluteIndex = pinnedItems.length + index
                    return (
                      <ConversationBox
                        key={item.id}
                        data={item}
                        selected={conversationId === item.id}
                        keyboardSelected={selectedConversationIndex === absoluteIndex}
                        currentUserId={currentUserId}
                        currentUserEmail={currentUserEmail}
                      />
                    )
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </aside>
    </>
  )
}

export default ConversationList
