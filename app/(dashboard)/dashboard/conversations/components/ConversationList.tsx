"use client"

import { useCallback, useEffect, useMemo, useReducer } from "react"
import dynamic from "next/dynamic"
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
import type {
  NotificationPreferences,
  SceneCharacterOption,
} from "@/app/(dashboard)/dashboard/conversations/types"
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

const SceneChatModal = dynamic(() => import("@/app/components/modals/SceneChatModal"), {
  ssr: false,
  loading: () => null,
})

interface ConversationListProps {
  initialItems: FullConversationType[]
  user: User[]
  currentUserId: string | null
  title?: string
  initialNotificationPrefs: NotificationPreferences | null
  sceneCharacters: SceneCharacterOption[]
}

interface ConversationTag {
  id: string
  name: string
  color: string | null
  conversationCount: number
}

interface ConversationListState {
  items: FullConversationType[]
  isGroupModalOpen: boolean
  isSceneModalOpen: boolean
  showArchived: boolean
  selectedTagId: string | null
}

type ConversationListAction =
  | { type: "sync_items"; items: FullConversationType[] }
  | { type: "set_items"; updater: React.SetStateAction<FullConversationType[]> }
  | { type: "open_group_modal" }
  | { type: "close_group_modal" }
  | { type: "open_scene_modal" }
  | { type: "close_scene_modal" }
  | { type: "toggle_archived" }
  | { type: "select_tag"; tagId: string | null }

const initialConversationListState = (
  initialItems: FullConversationType[]
): ConversationListState => ({
  items: initialItems,
  isGroupModalOpen: false,
  isSceneModalOpen: false,
  showArchived: false,
  selectedTagId: null,
})

function conversationListReducer(
  state: ConversationListState,
  action: ConversationListAction
): ConversationListState {
  switch (action.type) {
    case "sync_items":
      return { ...state, items: action.items }
    case "set_items":
      return {
        ...state,
        items: typeof action.updater === "function" ? action.updater(state.items) : action.updater,
      }
    case "open_group_modal":
      return { ...state, isGroupModalOpen: true }
    case "close_group_modal":
      return { ...state, isGroupModalOpen: false }
    case "open_scene_modal":
      return { ...state, isSceneModalOpen: true }
    case "close_scene_modal":
      return { ...state, isSceneModalOpen: false }
    case "toggle_archived":
      return { ...state, showArchived: !state.showArchived }
    case "select_tag":
      return { ...state, selectedTagId: action.tagId }
    default:
      return state
  }
}

interface ConversationListHeaderProps {
  title: string
  onOpenSearch: () => void
  onOpenNewConversation: () => void
  onOpenSceneChat: () => void
  onOpenGroupChat: () => void
}

function ConversationListHeader({
  title,
  onOpenSearch,
  onOpenNewConversation,
  onOpenSceneChat,
  onOpenGroupChat,
}: ConversationListHeaderProps) {
  return (
    <div className="mb-4 flex justify-between pt-4">
      <div className="text-2xl font-bold text-foreground">{title}</div>
      <div className="flex gap-2">
        <button
          onClick={onOpenSearch}
          className="cursor-pointer rounded-full bg-secondary p-2 text-secondary-foreground transition hover:opacity-75"
          title="Search (Cmd+K)"
          aria-label="Search conversations and messages (Cmd+K or Ctrl+K)"
        >
          <HiMagnifyingGlass size={20} />
        </button>
        <button
          onClick={onOpenNewConversation}
          className="cursor-pointer rounded-full bg-gradient-to-r from-purple-500 to-pink-500 p-2 text-white transition hover:opacity-75"
          title="New AI Chat"
          aria-label="Start new AI Chat"
        >
          <HiSparkles size={20} />
        </button>
        <button
          onClick={onOpenSceneChat}
          className="cursor-pointer rounded-full bg-secondary p-2 text-secondary-foreground transition hover:opacity-75"
          title="New Scene Chat"
          aria-label="Create new Scene Chat"
        >
          <HiChatBubbleLeftRight size={20} />
        </button>
        <button
          onClick={onOpenGroupChat}
          className="cursor-pointer rounded-full bg-secondary p-2 text-secondary-foreground transition hover:opacity-75"
          title="New Group Chat"
          aria-label="Create new Group Chat"
        >
          <MdOutlineGroupAdd size={20} />
        </button>
      </div>
    </div>
  )
}

interface ArchiveToggleButtonProps {
  archivedCount: number
  showArchived: boolean
  onToggle: () => void
}

function ArchiveToggleButton({ archivedCount, showArchived, onToggle }: ArchiveToggleButtonProps) {
  if (archivedCount === 0) {
    return null
  }

  return (
    <button
      onClick={onToggle}
      className="mb-4 flex w-full items-center justify-between rounded-lg border border-border bg-secondary px-4 py-2 text-sm text-secondary-foreground transition hover:bg-accent"
      aria-label={showArchived ? "Show active conversations" : "Show archived conversations"}
    >
      <div className="flex items-center gap-2">
        {showArchived ? <HiArchiveBoxXMark size={18} /> : <HiArchiveBox size={18} />}
        <span>{showArchived ? "Show Active" : "Show Archived"}</span>
      </div>
      {!showArchived && (
        <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
          {archivedCount}
        </span>
      )}
    </button>
  )
}

interface ConversationTagFilterProps {
  selectedTag: ConversationTag | null
  selectedTagId: string | null
  userTags: ConversationTag[]
  onSelectTag: (tagId: string | null) => void
}

function ConversationTagFilter({
  selectedTag,
  selectedTagId,
  userTags,
  onSelectTag,
}: ConversationTagFilterProps) {
  if (userTags.length === 0) {
    return null
  }

  return (
    <div className="mb-4">
      {selectedTag ? (
        <div className="flex items-center justify-between rounded-lg border border-border bg-secondary px-3 py-2">
          <div className="flex items-center gap-2 text-sm">
            <HiOutlineTag size={16} className="text-muted-foreground" />
            <span className="text-muted-foreground">Filtering by:</span>
            <TagBadge tag={selectedTag} size="sm" />
          </div>
          <button
            onClick={() => onSelectTag(null)}
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
              onSelect={() => onSelectTag(null)}
              className={!selectedTagId ? "font-medium" : ""}
            >
              All conversations
            </DropdownMenuItem>
            {userTags.map((tag) => {
              const colorScheme = TAG_COLORS[tag.color as TagColor] || TAG_COLORS.gray
              return (
                <DropdownMenuItem
                  key={tag.id}
                  onSelect={() => onSelectTag(tag.id)}
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
  )
}

interface ConversationItemsSectionProps {
  heading: string
  items: FullConversationType[]
  selectedConversationId: string
  selectedConversationIndex: number
  indexOffset?: number
  currentUserId: string | null
  currentUserEmail: string | null
  icon?: React.ReactNode
  counter?: React.ReactNode
}

function ConversationItemsSection({
  heading,
  items,
  selectedConversationId,
  selectedConversationIndex,
  indexOffset = 0,
  currentUserId,
  currentUserEmail,
  icon,
  counter,
}: ConversationItemsSectionProps) {
  if (items.length === 0) {
    return null
  }

  return (
    <div className={indexOffset === 0 ? "mb-2" : ""}>
      <div className="mb-2 flex items-center gap-2 px-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {icon}
        <span>{heading}</span>
        {counter}
      </div>
      {items.map((item, index) => (
        <ConversationBox
          key={item.id}
          data={item}
          selected={selectedConversationId === item.id}
          keyboardSelected={selectedConversationIndex === indexOffset + index}
          currentUserId={currentUserId}
          currentUserEmail={currentUserEmail}
        />
      ))}
    </div>
  )
}

const ConversationList: React.FC<ConversationListProps> = ({
  initialItems,
  user,
  currentUserId,
  title = "Messages",
  initialNotificationPrefs,
  sceneCharacters,
}) => {
  const [state, dispatch] = useReducer(
    conversationListReducer,
    initialItems,
    initialConversationListState
  )

  const { tags: userTags } = useTags()
  const { open: openSearch } = useGlobalSearchContext()
  const {
    selectedConversationIndex,
    setSelectedConversationIndex,
    setConversationCount,
    setSelectedConversationHref,
    openNewAIConversation,
  } = useKeyboardShortcutsContext()
  const { conversationId, isOpen } = useConversation()

  const notificationPrefs = currentUserId ? initialNotificationPrefs : null

  const setItems = useCallback<React.Dispatch<React.SetStateAction<FullConversationType[]>>>(
    (updater) => {
      dispatch({ type: "set_items", updater })
    },
    []
  )

  useEffect(() => {
    dispatch({ type: "sync_items", items: initialItems })
  }, [initialItems])

  usePusherConversationSync({
    currentUserId,
    items: state.items,
    setItems,
    notificationPrefs,
  })

  const currentUserEmail = useMemo(() => {
    if (!currentUserId) return null
    return user.find((currentUser) => currentUser.id === currentUserId)?.email ?? null
  }, [currentUserId, user])

  const filteredItems = useMemo(() => {
    if (!currentUserId) return state.items

    const filtered = state.items.filter((item) => {
      const isArchived = item.archivedBy?.includes(currentUserId) || false
      const archiveMatch = state.showArchived ? isArchived : !isArchived
      const tagMatch = state.selectedTagId
        ? item.tags?.some((tag: { id: string }) => tag.id === state.selectedTagId) || false
        : true

      return archiveMatch && tagMatch
    })

    return filtered.sort((a, b) => {
      const aIsPinned = a.pinnedBy?.includes(currentUserId) || false
      const bIsPinned = b.pinnedBy?.includes(currentUserId) || false

      if (aIsPinned === bIsPinned) {
        return new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime()
      }

      return aIsPinned ? -1 : 1
    })
  }, [state.items, currentUserId, state.showArchived, state.selectedTagId])

  const selectedTag = useMemo(() => {
    if (!state.selectedTagId) return null
    return userTags.find((tag) => tag.id === state.selectedTagId) || null
  }, [state.selectedTagId, userTags])

  const archivedCount = useMemo(() => {
    if (!currentUserId) return 0
    return state.items.filter((item) => item.archivedBy?.includes(currentUserId)).length
  }, [state.items, currentUserId])

  const pinnedItems = useMemo(() => {
    if (!currentUserId) return []
    return filteredItems.filter((item) => item.pinnedBy?.includes(currentUserId))
  }, [filteredItems, currentUserId])

  const unpinnedItems = useMemo(() => {
    if (!currentUserId) return filteredItems
    return filteredItems.filter((item) => !item.pinnedBy?.includes(currentUserId))
  }, [filteredItems, currentUserId])

  const selectedConversationHref = useMemo(() => {
    const selectedConversation = filteredItems[selectedConversationIndex]
    return selectedConversation ? `/dashboard/conversations/${selectedConversation.id}` : null
  }, [filteredItems, selectedConversationIndex])

  useEffect(() => {
    setConversationCount(filteredItems.length)
  }, [filteredItems.length, setConversationCount])

  useEffect(() => {
    setSelectedConversationHref(selectedConversationHref)

    return () => {
      setSelectedConversationHref(null)
    }
  }, [selectedConversationHref, setSelectedConversationHref])

  useEffect(() => {
    if (!conversationId) {
      return
    }

    const routeConversationIndex = filteredItems.findIndex((item) => item.id === conversationId)
    if (routeConversationIndex >= 0 && routeConversationIndex !== selectedConversationIndex) {
      setSelectedConversationIndex(routeConversationIndex)
    }
  }, [conversationId, filteredItems, selectedConversationIndex, setSelectedConversationIndex])

  const emptyStateMessage = state.selectedTagId
    ? `No conversations with this tag${state.showArchived ? " in archived" : ""}`
    : state.showArchived
      ? "No archived conversations"
      : "No active conversations"

  return (
    <>
      {state.isGroupModalOpen && (
        <GroupChatModal
          user={user}
          isOpen={state.isGroupModalOpen}
          onClose={() => dispatch({ type: "close_group_modal" })}
        />
      )}
      {state.isSceneModalOpen && (
        <SceneChatModal
          isOpen={state.isSceneModalOpen}
          onClose={() => dispatch({ type: "close_scene_modal" })}
          characters={sceneCharacters}
        />
      )}
      <aside
        className={clsx(
          "fixed inset-y-0 overflow-y-auto border-r border-border bg-background pb-20 lg:left-20 lg:block lg:w-80 lg:pb-0",
          isOpen ? "hidden" : "left-0 block w-full"
        )}
      >
        <div className="px-5">
          <ConversationListHeader
            title={state.showArchived ? "Archived" : title}
            onOpenSearch={openSearch}
            onOpenNewConversation={openNewAIConversation}
            onOpenSceneChat={() => dispatch({ type: "open_scene_modal" })}
            onOpenGroupChat={() => dispatch({ type: "open_group_modal" })}
          />

          <ArchiveToggleButton
            archivedCount={archivedCount}
            showArchived={state.showArchived}
            onToggle={() => dispatch({ type: "toggle_archived" })}
          />

          <ConversationTagFilter
            selectedTag={selectedTag}
            selectedTagId={state.selectedTagId}
            userTags={userTags as ConversationTag[]}
            onSelectTag={(tagId) => dispatch({ type: "select_tag", tagId })}
          />

          {filteredItems.length === 0 ? (
            <div className="mt-8 text-center text-sm text-muted-foreground">
              {emptyStateMessage}
            </div>
          ) : (
            <>
              <ConversationItemsSection
                heading="Pinned"
                items={pinnedItems}
                selectedConversationId={conversationId}
                selectedConversationIndex={selectedConversationIndex}
                currentUserId={currentUserId}
                currentUserEmail={currentUserEmail}
                icon={<BsPinAngleFill size={12} className="text-primary" />}
                counter={
                  <span className="text-xs text-muted-foreground">({pinnedItems.length}/5)</span>
                }
              />

              {unpinnedItems.length > 0 && (
                <div className={pinnedItems.length > 0 ? "mt-4" : ""}>
                  {pinnedItems.length > 0 && (
                    <div className="mb-2 px-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      All Conversations
                    </div>
                  )}
                  {unpinnedItems.map((item, index) => (
                    <ConversationBox
                      key={item.id}
                      data={item}
                      selected={conversationId === item.id}
                      keyboardSelected={selectedConversationIndex === pinnedItems.length + index}
                      currentUserId={currentUserId}
                      currentUserEmail={currentUserEmail}
                    />
                  ))}
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
