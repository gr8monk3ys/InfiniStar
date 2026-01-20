"use client"

import { useMemo } from "react"
import Image from "next/image"
import { format, formatDistanceToNow } from "date-fns"
import {
  HiOutlineArchiveBox,
  HiOutlineChatBubbleLeftRight,
  HiOutlinePhoto,
  HiSparkles,
  HiUser,
} from "react-icons/hi2"

import { TAG_COLORS, type TagColor } from "@/app/types"
import type { ConversationSearchResult, MessageSearchResult } from "@/app/types/search"

/**
 * Simple avatar component for search results
 */
interface AvatarProps {
  name: string | null
  email: string | null
  image: string | null
  className?: string
  size?: "sm" | "md"
}

function Avatar({ name, email, image, className = "", size = "md" }: AvatarProps) {
  const sizeClasses = size === "sm" ? "size-8" : "size-10"
  const altText = name
    ? `${name}'s profile picture`
    : email
    ? `${email}'s profile picture`
    : "User profile picture"

  return (
    <div className={`relative shrink-0 overflow-hidden rounded-full ${sizeClasses} ${className}`}>
      <Image fill src={image || "/placeholder.jpg"} alt={altText} className="object-cover" />
    </div>
  )
}

/**
 * Render highlighted text with [hl]...[/hl] markers
 */
function HighlightedText({ text }: { text: string }) {
  const parts = text.split(/\[hl\]|\[\/hl\]/)
  /* eslint-disable react/no-array-index-key */
  return (
    <>
      {parts.map((part, index) => {
        if (index % 2 === 1) {
          return (
            <mark
              key={`hl-${index}`}
              className="rounded bg-yellow-200 px-0.5 font-medium text-gray-900"
            >
              {part}
            </mark>
          )
        }
        return <span key={`text-${index}`}>{part}</span>
      })}
    </>
  )
  /* eslint-enable react/no-array-index-key */
}

/**
 * Conversation search result item
 */
interface ConversationResultProps {
  conversation: ConversationSearchResult
  onClick: () => void
  isSelected?: boolean
  dataIndex?: number
}

export function ConversationResultItem({
  conversation,
  onClick,
  isSelected = false,
  dataIndex,
}: ConversationResultProps) {
  const displayName = useMemo(() => {
    if (conversation.name) return conversation.name
    if (conversation.isAI) return "AI Conversation"
    if (conversation.users.length > 0) {
      return conversation.users.map((u) => u.name || u.email).join(", ")
    }
    return "Conversation"
  }, [conversation])

  const timeAgo = useMemo(() => {
    try {
      return formatDistanceToNow(new Date(conversation.lastMessageAt), { addSuffix: true })
    } catch {
      return ""
    }
  }, [conversation.lastMessageAt])

  return (
    <button
      type="button"
      data-index={dataIndex}
      onClick={onClick}
      className={`flex w-full items-start gap-3 rounded-lg border p-3 text-left transition-colors ${
        isSelected ? "border-sky-500 bg-sky-50" : "border-gray-200 bg-white hover:bg-gray-50"
      }`}
      role="option"
      aria-selected={isSelected}
    >
      {/* Icon/Avatar */}
      <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-gray-100">
        {conversation.isAI ? (
          <HiSparkles className="size-5 text-purple-500" />
        ) : conversation.isGroup ? (
          <HiOutlineChatBubbleLeftRight className="size-5 text-sky-500" />
        ) : conversation.users[0] ? (
          <Avatar
            name={conversation.users[0].name}
            email={conversation.users[0].email}
            image={conversation.users[0].image}
          />
        ) : (
          <HiUser className="size-5 text-gray-400" />
        )}
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        {/* Header */}
        <div className="flex items-center gap-2">
          <p className="truncate font-medium text-gray-900">{displayName}</p>
          {conversation.isAI && (
            <span className="shrink-0 rounded bg-purple-100 px-1.5 py-0.5 text-xs text-purple-600">
              AI
            </span>
          )}
          {conversation.isGroup && (
            <span className="shrink-0 rounded bg-sky-100 px-1.5 py-0.5 text-xs text-sky-600">
              Group
            </span>
          )}
          {conversation.isArchived && (
            <HiOutlineArchiveBox className="size-4 shrink-0 text-gray-400" title="Archived" />
          )}
        </div>

        {/* Meta info */}
        <p className="text-xs text-gray-500">
          {conversation.messageCount} messages · {timeAgo}
        </p>

        {/* Tags */}
        {conversation.tags && conversation.tags.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {conversation.tags.slice(0, 3).map((tag) => {
              const colorScheme = TAG_COLORS[tag.color as TagColor] || TAG_COLORS.gray
              return (
                <span
                  key={tag.id}
                  className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${colorScheme.bg} ${colorScheme.text}`}
                >
                  {tag.name}
                </span>
              )
            })}
            {conversation.tags.length > 3 && (
              <span className="text-[10px] text-gray-400">
                +{conversation.tags.length - 3} more
              </span>
            )}
          </div>
        )}

        {/* AI Personality */}
        {conversation.isAI && conversation.aiPersonality && (
          <p className="mt-1 text-xs capitalize text-purple-600">
            {conversation.aiPersonality} personality
          </p>
        )}
      </div>

      {/* Relevance indicator */}
      {conversation.relevanceScore !== undefined && conversation.relevanceScore > 20 && (
        <div
          className="shrink-0 rounded bg-green-100 px-1.5 py-0.5 text-[10px] font-medium text-green-700"
          title={`Relevance: ${conversation.relevanceScore}`}
        >
          Top match
        </div>
      )}
    </button>
  )
}

/**
 * Message search result item
 */
interface MessageResultProps {
  message: MessageSearchResult
  onClick: () => void
  isSelected?: boolean
  dataIndex?: number
}

export function MessageResultItem({
  message,
  onClick,
  isSelected = false,
  dataIndex,
}: MessageResultProps) {
  const formattedDate = useMemo(() => {
    try {
      return format(new Date(message.createdAt), "MMM d, yyyy 'at' h:mm a")
    } catch {
      return ""
    }
  }, [message.createdAt])

  const conversationName = useMemo(() => {
    if (message.conversation.name) return message.conversation.name
    if (message.conversation.isAI) return "AI Conversation"
    return "Conversation"
  }, [message.conversation])

  return (
    <button
      type="button"
      data-index={dataIndex}
      onClick={onClick}
      className={`flex w-full items-start gap-3 rounded-lg border p-3 text-left transition-colors ${
        isSelected ? "border-sky-500 bg-sky-50" : "border-gray-200 bg-white hover:bg-gray-50"
      }`}
      role="option"
      aria-selected={isSelected}
    >
      {/* Sender avatar */}
      <Avatar
        name={message.sender.name}
        email={message.sender.email}
        image={message.sender.image}
      />

      {/* Content */}
      <div className="min-w-0 flex-1">
        {/* Header */}
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-gray-900">
            {message.sender.name || message.sender.email}
          </p>
          {message.isAI && (
            <span className="shrink-0 rounded bg-purple-100 px-1.5 py-0.5 text-xs text-purple-600">
              AI
            </span>
          )}
          {message.hasImage && (
            <HiOutlinePhoto className="size-4 shrink-0 text-amber-500" title="Has image" />
          )}
          <span className="text-xs text-gray-400">{formattedDate}</span>
        </div>

        {/* Conversation context */}
        <p className="text-xs text-gray-500">
          in <span className="font-medium">{conversationName}</span>
          {message.conversation.isGroup && " (Group)"}
        </p>

        {/* Message body with highlighting */}
        <p className="mt-1 line-clamp-2 text-sm text-gray-700">
          <HighlightedText text={message.highlightedBody} />
        </p>

        {/* Context preview */}
        {message.context && (message.context.before || message.context.after) && (
          <div className="mt-1.5 rounded border-l-2 border-gray-200 pl-2 text-xs text-gray-400">
            {message.context.before && <p className="line-clamp-1">...{message.context.before}</p>}
            {message.context.after && <p className="line-clamp-1">{message.context.after}...</p>}
          </div>
        )}
      </div>

      {/* Relevance indicator */}
      {message.relevanceScore !== undefined && message.relevanceScore > 15 && (
        <div
          className="shrink-0 rounded bg-green-100 px-1.5 py-0.5 text-[10px] font-medium text-green-700"
          title={`Relevance: ${message.relevanceScore}`}
        >
          Top match
        </div>
      )}
    </button>
  )
}

/**
 * Loading skeleton for search results
 */
export function SearchResultSkeleton() {
  return (
    <div className="flex w-full items-start gap-3 rounded-lg border border-gray-200 bg-white p-3">
      {/* Avatar skeleton */}
      <div className="size-10 shrink-0 animate-pulse rounded-full bg-gray-200" />

      {/* Content skeleton */}
      <div className="min-w-0 flex-1 space-y-2">
        <div className="h-4 w-1/3 animate-pulse rounded bg-gray-200" />
        <div className="h-3 w-1/2 animate-pulse rounded bg-gray-200" />
        <div className="h-3 w-full animate-pulse rounded bg-gray-200" />
      </div>
    </div>
  )
}

const SearchResultComponents = { ConversationResultItem, MessageResultItem, SearchResultSkeleton }
export default SearchResultComponents
