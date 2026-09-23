"use client"

import { useCallback, useEffect, useMemo, useReducer, useState } from "react"
import dynamic from "next/dynamic"
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

import { isGroupChatEnabled } from "@/app/lib/features"
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
import { TAG_COLORS, type FullConversationType, type TagColor, type UserSummary } from "@/app/types"

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
  user: UserSummary[]
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

// Static, so created once rather than on every render.
const pinnedSectionIcon = <BsPinAngleFill size={12} className="text-primary" aria-hidden="true" />

function lastMessageTime(item: FullConversationType): number {
  return new Date(item.lastMessageAt).getTime()
}

function byMostRecent(a: FullConversationType, b: FullConversationType): number {
  return lastMessageTime(b) - lastMessageTime(a)
}

interface ConversationListHeaderProps {
  title: string
  onOpenSearch: () => void
  onOpenNewConversation: () => void
  onOpenSceneChat: () => void
  onOpenGroupChat: () => void
  showGroupChat: boolean
}

function ConversationListHeader({
  title,
  onOpenSearch,
  onOpenNewConversation,
  onOpenSceneChat,
  onOpenGroupChat,
  showGroupChat,
}: ConversationListHeaderProps) {
  return (
    <div className="mb-4 flex justify-between pt-4">
      <h2 className="text-2xl font-bold text-foreground">{title}</h2>
      <div className="flex gap-2">
        <button
          onClick={onOpenSearch}
          className="cursor-pointer rounded-full bg-secondary p-2 text-secondary-foreground transition hover:opacity-75"
          title="Search (Cmd+K)"
          aria-label="Search conversations and messages (Cmd+K or Ctrl+K)"
        >
          <HiMagnifyingGlass size={20} aria-hidden="true" />
        </button>
        <button
          onClick={onOpenNewConversation}
          className="gradient-bg cursor-pointer rounded-full p-2 text-white transition hover:opacity-75"
          title="New character chat"
          aria-label="Start new character chat"
        >
          <HiSparkles size={20} aria-hidden="true" />
        </button>
        <button
          onClick={onOpenSceneChat}
          className="cursor-pointer rounded-full bg-secondary p-2 text-secondary-foreground transition hover:opacity-75"
          title="New scene: a chat with several characters at once"
          aria-label="Create new scene, a chat with several characters at once"
        >
          <HiChatBubbleLeftRight size={20} aria-hidden="true" />
        </button>
        {showGroupChat && (
          <button
            onClick={onOpenGroupChat}
            className="cursor-pointer rounded-full bg-secondary p-2 text-secondary-foreground transition hover:opacity-75"
            title="New Group Chat"
            aria-label="Create new Group Chat"
          >
            <MdOutlineGroupAdd size={20} aria-hidden="true" />
          </button>
        )}
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
        {showArchived ? (
          <HiArchiveBoxXMark size={18} aria-hidden="true" />
        ) : (
          <HiArchiveBox size={18} aria-hidden="true" />
        )}
        <span>{showArchived ? "Show Active" : "Show Archived"}</span>
      </div>
      {!showArchived && (
        <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium tabular-nums text-muted-foreground">
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
            <HiOutlineTag size={16} className="text-muted-foreground" aria-hidden="true" />
            <span className="text-muted-foreground">Filtering by:</span>
            <TagBadge tag={selectedTag} size="sm" />
          </div>
          <button
            onClick={() => onSelectTag(null)}
            className="rounded-full p-1 text-muted-foreground transition hover:bg-accent hover:text-foreground"
            aria-label="Clear tag filter"
            title="Clear filter"
          >
            <HiXMark size={16} aria-hidden="true" />
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
                <HiOutlineTag size={18} aria-hidden="true" />
                <span>Filter by Tag</span>
              </div>
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium tabular-nums text-muted-foreground">
                {userTags.length}
              </span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuLabel>Filter by Tag</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={() => onSelectTag(null)}
              className={!selectedTagId ? "font-medium" : ""}
            >
              All Conversations
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
                    aria-hidden="true"
                    className={clsx(
                      "mr-2 size-3 shrink-0 rounded-full border",
                      colorScheme.bg,
                      colorScheme.border
                    )}
                  />
                  <span className="truncate">{tag.name}</span>
                  <span className="ml-auto text-xs tabular-nums text-muted-foreground">
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
  icon,
  counter,
}: ConversationItemsSectionProps) {
  if (items.length === 0) {
    return null
  }

  return (
    <div className={indexOffset === 0 ? "mb-2" : ""}>
      <h3 className="mb-2 flex items-center gap-2 px-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {icon}
        <span>{heading}</span>
        {counter}
      </h3>
      {items.map((item, index) => (
        <ConversationBox
          key={item.id}
          data={item}
          selected={selectedConversationId === item.id}
          keyboardSelected={selectedConversationIndex === indexOffset + index}
          currentUserId={currentUserId}
        />
      ))}
    </div>
  )
}

const ConversationList: React.FC<ConversationListProps> = ({
  initialItems,
  user,
  currentUserId,
  title = "Conversations",
  initialNotificationPrefs,
  sceneCharacters,
}) => {
  const groupChatEnabled = isGroupChatEnabled()
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

  // A new server list (router.refresh) replaces the local one. Adjusted during
  // render rather than in an effect, so the stale list is never painted.
  const [syncedInitialItems, setSyncedInitialItems] = useState(initialItems)
  if (syncedInitialItems !== initialItems) {
    setSyncedInitialItems(initialItems)
    dispatch({ type: "sync_items", items: initialItems })
  }

  usePusherConversationSync({
    currentUserId,
    items: state.items,
    setItems,
    notificationPrefs,
  })

  // One pass over the list: archive count, filter, and the pinned/unpinned split.
  // Pinned conversations come first, each group newest-first.
  const { filteredItems, pinnedItems, unpinnedItems, archivedCount } = useMemo(() => {
    if (!currentUserId) {
      return {
        filteredItems: state.items,
        pinnedItems: [] as FullConversationType[],
        unpinnedItems: state.items,
        archivedCount: 0,
      }
    }

    const pinned: FullConversationType[] = []
    const unpinned: FullConversationType[] = []
    let archived = 0

    for (const item of state.items) {
      const isArchived = item.archivedBy?.includes(currentUserId) || false
      if (isArchived) archived++

      const archiveMatch = state.showArchived ? isArchived : !isArchived
      const tagMatch = state.selectedTagId
        ? item.tags?.some((tag: { id: string }) => tag.id === state.selectedTagId) || false
        : true
      if (!archiveMatch || !tagMatch) continue

      if (item.pinnedBy?.includes(currentUserId)) {
        pinned.push(item)
      } else {
        unpinned.push(item)
      }
    }

    pinned.sort(byMostRecent)
    unpinned.sort(byMostRecent)

    return {
      filteredItems: [...pinned, ...unpinned],
      pinnedItems: pinned,
      unpinnedItems: unpinned,
      archivedCount: archived,
    }
  }, [state.items, currentUserId, state.showArchived, state.selectedTagId])

  const selectedTag = useMemo(() => {
    if (!state.selectedTagId) return null
    return userTags.find((tag) => tag.id === state.selectedTagId) || null
  }, [state.selectedTagId, userTags])

  // A cheap string expression, so not memoized.
  const selectedConversation = filteredItems[selectedConversationIndex]
  const selectedConversationHref = selectedConversation
    ? `/dashboard/conversations/${selectedConversation.id}`
    : null

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
    ? `No ${state.showArchived ? "archived " : ""}conversations with this tag`
    : state.showArchived
      ? "No archived conversations"
      : "No active conversations"

  return (
    <>
      {groupChatEnabled && state.isGroupModalOpen && (
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
        aria-label="Conversations"
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
            showGroupChat={groupChatEnabled}
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
                icon={pinnedSectionIcon}
                counter={
                  <span className="text-xs tabular-nums text-muted-foreground">
                    ({pinnedItems.length}/5)
                  </span>
                }
              />

              {unpinnedItems.length > 0 && (
                <div className={pinnedItems.length > 0 ? "mt-4" : ""}>
                  {pinnedItems.length > 0 && (
                    <h3 className="mb-2 px-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      All Conversations
                    </h3>
                  )}
                  {unpinnedItems.map((item, index) => (
                    <ConversationBox
                      key={item.id}
                      data={item}
                      selected={conversationId === item.id}
                      keyboardSelected={selectedConversationIndex === pinnedItems.length + index}
                      currentUserId={currentUserId}
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
