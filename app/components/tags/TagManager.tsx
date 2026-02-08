"use client"

import { memo, useCallback, useState } from "react"
import { HiOutlinePencil, HiOutlineTrash, HiPlus } from "react-icons/hi2"

import { cn } from "@/app/lib/utils"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/app/components/ui/alert-dialog"
import { useTags } from "@/app/hooks/useTags"
import { TAG_COLORS, type TagColor, type TagWithCount } from "@/app/types"

import TagBadge from "./TagBadge"

interface TagManagerProps {
  /** Additional className for the container */
  className?: string
}

/**
 * TagManager - Settings page component to manage all user tags
 *
 * Provides full CRUD functionality for tags:
 * - List all tags with usage counts
 * - Create new tags with name and color
 * - Edit existing tags
 * - Delete tags (with confirmation)
 */
const TagManager: React.FC<TagManagerProps> = ({ className }) => {
  const { tags, isLoading, createTag, updateTag, deleteTag } = useTags()

  // Form state for creating/editing tags
  const [showForm, setShowForm] = useState(false)
  const [editingTag, setEditingTag] = useState<TagWithCount | null>(null)
  const [formName, setFormName] = useState("")
  const [formColor, setFormColor] = useState<TagColor>("blue")
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Delete confirmation
  const [tagToDelete, setTagToDelete] = useState<TagWithCount | null>(null)

  const resetForm = useCallback(() => {
    setShowForm(false)
    setEditingTag(null)
    setFormName("")
    setFormColor("blue")
  }, [])

  const handleEditClick = useCallback((tag: TagWithCount) => {
    setEditingTag(tag)
    setFormName(tag.name)
    setFormColor(tag.color as TagColor)
    setShowForm(true)
  }, [])

  const handleSubmit = useCallback(async () => {
    if (!formName.trim()) return

    setIsSubmitting(true)

    if (editingTag) {
      // Update existing tag
      const updated = await updateTag(editingTag.id, {
        name: formName.trim(),
        color: formColor,
      })
      if (updated) {
        resetForm()
      }
    } else {
      // Create new tag
      const created = await createTag(formName.trim(), formColor)
      if (created) {
        resetForm()
      }
    }

    setIsSubmitting(false)
  }, [formName, formColor, editingTag, createTag, updateTag, resetForm])

  const handleDelete = useCallback(async () => {
    if (!tagToDelete) return

    await deleteTag(tagToDelete.id)
    setTagToDelete(null)
  }, [tagToDelete, deleteTag])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && formName.trim()) {
        e.preventDefault()
        handleSubmit()
      } else if (e.key === "Escape") {
        resetForm()
      }
    },
    [formName, handleSubmit, resetForm]
  )

  return (
    <div className={cn("space-y-6", className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Tags</h2>
          <p className="text-sm text-muted-foreground">
            Organize your conversations with custom tags
          </p>
        </div>
        {!showForm && (
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            <HiPlus className="size-4" />
            Create Tag
          </button>
        )}
      </div>

      {/* Create/Edit Form */}
      {showForm && (
        <div className="rounded-lg border border-border bg-card p-4">
          <h3 className="mb-4 text-sm font-medium text-foreground">
            {editingTag ? "Edit Tag" : "Create New Tag"}
          </h3>

          <div className="space-y-4">
            {/* Name input */}
            <div>
              <label htmlFor="tag-name" className="mb-1 block text-sm font-medium text-foreground">
                Name
              </label>
              <input
                id="tag-name"
                type="text"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="e.g., Work, Personal, Important"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                maxLength={30}
                autoFocus
              />
              <p className="mt-1 text-xs text-muted-foreground">{formName.length}/30 characters</p>
            </div>

            {/* Color picker */}
            <div>
              <label className="mb-2 block text-sm font-medium text-foreground">Color</label>
              <div className="flex flex-wrap gap-2">
                {(Object.keys(TAG_COLORS) as TagColor[]).map((color) => {
                  const colorScheme = TAG_COLORS[color]
                  return (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setFormColor(color)}
                      className={cn(
                        "flex items-center gap-2 rounded-md px-3 py-1.5 text-sm transition-all",
                        colorScheme.bg,
                        colorScheme.text,
                        colorScheme.border,
                        "border",
                        formColor === color && "ring-2 ring-ring ring-offset-2"
                      )}
                      aria-label={`Select ${color} color`}
                    >
                      {color}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Preview */}
            {formName.trim() && (
              <div>
                <label className="mb-2 block text-sm font-medium text-foreground">Preview</label>
                <TagBadge
                  tag={{
                    id: "preview",
                    name: formName.trim(),
                    color: formColor,
                  }}
                  size="md"
                />
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={resetForm}
                className="flex-1 rounded-md bg-secondary px-4 py-2 text-sm font-medium text-secondary-foreground transition-colors hover:bg-secondary/80"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={!formName.trim() || isSubmitting}
                className="flex-1 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
              >
                {isSubmitting
                  ? editingTag
                    ? "Updating..."
                    : "Creating..."
                  : editingTag
                    ? "Update Tag"
                    : "Create Tag"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tags List */}
      {isLoading ? (
        <div className="py-8 text-center text-muted-foreground">
          <div className="mx-auto mb-2 size-8 animate-spin rounded-full border-2 border-muted border-t-primary" />
          Loading tags...
        </div>
      ) : tags.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border py-12 text-center">
          <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-muted">
            <HiPlus className="size-6 text-muted-foreground" />
          </div>
          <h3 className="mb-1 text-sm font-medium text-foreground">No tags yet</h3>
          <p className="mb-4 text-sm text-muted-foreground">
            Create tags to organize your conversations
          </p>
          {!showForm && (
            <button
              type="button"
              onClick={() => setShowForm(true)}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              <HiPlus className="size-4" />
              Create your first tag
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {tags.map((tag) => (
            <div
              key={tag.id}
              className="flex items-center justify-between rounded-lg border border-border bg-card p-3 transition-colors hover:bg-accent/50"
            >
              <div className="flex items-center gap-3">
                <TagBadge tag={tag} size="md" truncate={false} />
                <span className="text-sm text-muted-foreground">
                  {tag.conversationCount}{" "}
                  {tag.conversationCount === 1 ? "conversation" : "conversations"}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => handleEditClick(tag)}
                  className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                  title="Edit tag"
                  aria-label={`Edit tag ${tag.name}`}
                >
                  <HiOutlinePencil className="size-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setTagToDelete(tag)}
                  className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                  title="Delete tag"
                  aria-label={`Delete tag ${tag.name}`}
                >
                  <HiOutlineTrash className="size-4" />
                </button>
              </div>
            </div>
          ))}

          <p className="pt-2 text-xs text-muted-foreground">{tags.length}/20 tags used</p>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!tagToDelete} onOpenChange={() => setTagToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Tag</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the tag &quot;{tagToDelete?.name}&quot;? This will
              remove it from all {tagToDelete?.conversationCount || 0} conversations. This action
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

export default memo(TagManager)
