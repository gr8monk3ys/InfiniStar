"use client"

import { memo, useCallback, useMemo, useState } from "react"
import { type Tag } from "@prisma/client"
import { HiCheck, HiOutlineTag, HiPlus } from "react-icons/hi2"

import { cn } from "@/app/lib/utils"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/app/components/ui/dropdown-menu"
import { useConversationTags, useTags } from "@/app/hooks/useTags"
import { TAG_COLORS, type TagColor } from "@/app/types"

import TagBadge from "./TagBadge"

interface TagSelectorProps {
  /** ID of the conversation to manage tags for */
  conversationId: string
  /** Currently applied tags on the conversation */
  currentTags: Tag[]
  /** Callback when tags change */
  onTagsChange?: (tags: Tag[]) => void
  /** Size variant */
  size?: "sm" | "md"
  /** Custom trigger element */
  trigger?: React.ReactNode
  /** Align dropdown to start or end */
  align?: "start" | "center" | "end"
}

/**
 * TagSelector - Dropdown to add/remove tags from a conversation
 *
 * Shows all available user tags with checkmarks for applied ones.
 * Allows quick creation of new tags.
 */
const TagSelector: React.FC<TagSelectorProps> = ({
  conversationId,
  currentTags,
  onTagsChange,
  size = "sm",
  trigger,
  align = "start",
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [newTagName, setNewTagName] = useState("")
  const [newTagColor, setNewTagColor] = useState<TagColor>("blue")

  const { tags: allTags, isLoading: isLoadingTags, createTag } = useTags()
  const { addTag, removeTag, isLoading: isUpdating } = useConversationTags(conversationId)

  // Get IDs of currently applied tags
  const appliedTagIds = useMemo(() => new Set(currentTags.map((t) => t.id)), [currentTags])

  const handleToggleTag = useCallback(
    async (tag: Tag) => {
      const isApplied = appliedTagIds.has(tag.id)

      let success: boolean
      if (isApplied) {
        success = await removeTag(tag.id)
        if (success && onTagsChange) {
          onTagsChange(currentTags.filter((t) => t.id !== tag.id))
        }
      } else {
        success = await addTag(tag.id)
        if (success && onTagsChange) {
          onTagsChange([...currentTags, tag])
        }
      }
    },
    [appliedTagIds, addTag, removeTag, currentTags, onTagsChange]
  )

  const handleCreateTag = useCallback(async () => {
    if (!newTagName.trim()) return

    const createdTag = await createTag(newTagName.trim(), newTagColor)
    if (createdTag) {
      // Automatically add the new tag to the conversation
      const success = await addTag(createdTag.id)
      if (success && onTagsChange) {
        onTagsChange([...currentTags, createdTag])
      }
      setNewTagName("")
      setNewTagColor("blue")
      setShowCreateForm(false)
    }
  }, [newTagName, newTagColor, createTag, addTag, currentTags, onTagsChange])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && newTagName.trim()) {
        e.preventDefault()
        handleCreateTag()
      } else if (e.key === "Escape") {
        setShowCreateForm(false)
        setNewTagName("")
      }
    },
    [newTagName, handleCreateTag]
  )

  const defaultTrigger = (
    <button
      type="button"
      className={cn(
        "flex items-center gap-1 rounded-md px-2 py-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
        size === "sm" && "text-xs",
        size === "md" && "text-sm"
      )}
      title="Manage tags"
      aria-label="Manage conversation tags"
    >
      <HiOutlineTag className={cn(size === "sm" ? "size-3.5" : "size-4")} />
      <span className="hidden sm:inline">Tags</span>
    </button>
  )

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>{trigger || defaultTrigger}</DropdownMenuTrigger>
      <DropdownMenuContent align={align} className="w-56">
        <DropdownMenuLabel>Tags</DropdownMenuLabel>
        <DropdownMenuSeparator />

        {isLoadingTags ? (
          <div className="px-2 py-4 text-center text-sm text-muted-foreground">Loading tags...</div>
        ) : allTags.length === 0 && !showCreateForm ? (
          <div className="px-2 py-4 text-center text-sm text-muted-foreground">
            <p className="mb-2">No tags yet</p>
            <button
              type="button"
              onClick={() => setShowCreateForm(true)}
              className="inline-flex items-center gap-1 text-primary hover:underline"
            >
              <HiPlus className="size-3" />
              Create your first tag
            </button>
          </div>
        ) : (
          <>
            {/* Existing tags */}
            <div className="max-h-48 overflow-y-auto">
              {allTags.map((tag) => {
                const isApplied = appliedTagIds.has(tag.id)
                const colorScheme = TAG_COLORS[tag.color as TagColor] || TAG_COLORS.gray

                return (
                  <DropdownMenuItem
                    key={tag.id}
                    onClick={(e) => {
                      e.preventDefault()
                      handleToggleTag(tag)
                    }}
                    disabled={isUpdating}
                    className="cursor-pointer"
                  >
                    <div className="flex w-full items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span
                          className={cn(
                            "size-3 rounded-full",
                            colorScheme.bg,
                            colorScheme.border,
                            "border"
                          )}
                        />
                        <span className="truncate">{tag.name}</span>
                      </div>
                      {isApplied && <HiCheck className="size-4 text-primary" />}
                    </div>
                  </DropdownMenuItem>
                )
              })}
            </div>

            <DropdownMenuSeparator />

            {/* Create new tag */}
            {showCreateForm ? (
              <div
                className="p-2"
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => e.stopPropagation()}
              >
                <input
                  type="text"
                  value={newTagName}
                  onChange={(e) => setNewTagName(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Tag name"
                  className="mb-2 w-full rounded-md border border-input bg-background px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                  maxLength={30}
                  autoFocus
                />

                {/* Color picker */}
                <div className="mb-2 flex flex-wrap gap-1">
                  {(Object.keys(TAG_COLORS) as TagColor[]).map((color) => {
                    const colorScheme = TAG_COLORS[color]
                    return (
                      <button
                        key={color}
                        type="button"
                        onClick={() => setNewTagColor(color)}
                        className={cn(
                          "size-5 rounded-full border-2 transition-all",
                          colorScheme.bg,
                          newTagColor === color
                            ? "border-foreground ring-2 ring-ring ring-offset-1"
                            : "border-transparent hover:scale-110"
                        )}
                        title={color}
                        aria-label={`Select ${color} color`}
                      />
                    )
                  })}
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowCreateForm(false)
                      setNewTagName("")
                    }}
                    className="flex-1 rounded-md bg-secondary px-2 py-1 text-xs text-secondary-foreground hover:bg-secondary/80"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleCreateTag}
                    disabled={!newTagName.trim()}
                    className="flex-1 rounded-md bg-primary px-2 py-1 text-xs text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                  >
                    Create
                  </button>
                </div>
              </div>
            ) : (
              <DropdownMenuItem
                onClick={(e) => {
                  e.preventDefault()
                  setShowCreateForm(true)
                }}
                className="cursor-pointer"
              >
                <HiPlus className="mr-2 size-4" />
                Create new tag
              </DropdownMenuItem>
            )}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/**
 * TagSelectorWithBadges - Shows applied tags as badges with a selector trigger
 *
 * Compact view for the conversation sidebar that shows applied tags
 * and allows tag management.
 */
interface TagSelectorWithBadgesProps extends Omit<TagSelectorProps, "trigger"> {
  /** Maximum number of tags to show before "+X more" */
  maxVisible?: number
}

export const TagSelectorWithBadges: React.FC<TagSelectorWithBadgesProps> = ({
  currentTags,
  maxVisible = 2,
  ...props
}) => {
  const visibleTags = currentTags.slice(0, maxVisible)
  const hiddenCount = currentTags.length - maxVisible

  if (currentTags.length === 0) {
    return <TagSelector currentTags={currentTags} {...props} />
  }

  const trigger = (
    <button
      type="button"
      className="flex flex-wrap items-center gap-1"
      title="Manage tags"
      aria-label="Manage conversation tags"
    >
      {visibleTags.map((tag) => (
        <TagBadge key={tag.id} tag={tag} size="sm" />
      ))}
      {hiddenCount > 0 && (
        <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
          +{hiddenCount}
        </span>
      )}
    </button>
  )

  return <TagSelector currentTags={currentTags} trigger={trigger} {...props} />
}

export default memo(TagSelector)
