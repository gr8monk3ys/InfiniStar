"use client"

import { memo, useCallback, useMemo, useState } from "react"
import { useSearchParams } from "next/navigation"
import { MemoryCategory } from "@prisma/client"
import {
  HiOutlineClock,
  HiOutlineExclamationCircle,
  HiOutlinePencil,
  HiOutlineTrash,
  HiPlus,
} from "react-icons/hi2"

import { formatDate } from "@/app/lib/intl-format"
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
import { useMemories, type MemoryWithMeta } from "@/app/hooks/useMemories"

// Category colors and metadata
const CATEGORY_STYLES: Record<
  MemoryCategory,
  { label: string; bg: string; text: string; border: string }
> = {
  PREFERENCE: {
    label: "Preference",
    bg: "bg-blue-100 dark:bg-blue-900/30",
    text: "text-blue-700 dark:text-blue-300",
    border: "border-blue-200 dark:border-blue-800",
  },
  FACT: {
    label: "Fact",
    bg: "bg-green-100 dark:bg-green-900/30",
    text: "text-green-700 dark:text-green-300",
    border: "border-green-200 dark:border-green-800",
  },
  CONTEXT: {
    label: "Context",
    bg: "bg-purple-100 dark:bg-purple-900/30",
    text: "text-purple-700 dark:text-purple-300",
    border: "border-purple-200 dark:border-purple-800",
  },
  INSTRUCTION: {
    label: "Instruction",
    bg: "bg-orange-100 dark:bg-orange-900/30",
    text: "text-orange-700 dark:text-orange-300",
    border: "border-orange-200 dark:border-orange-800",
  },
  RELATIONSHIP: {
    label: "Relationship",
    bg: "bg-pink-100 dark:bg-pink-900/30",
    text: "text-pink-700 dark:text-pink-300",
    border: "border-pink-200 dark:border-pink-800",
  },
}

const CATEGORY_KEYS = Object.keys(CATEGORY_STYLES) as MemoryCategory[]

function isMemoryCategory(value: string): value is MemoryCategory {
  return Object.prototype.hasOwnProperty.call(CATEGORY_STYLES, value)
}

/** Query param holding the category filter, so a filtered list survives reloads and links. */
const FILTER_PARAM = "memoryCategory"

/** Anything that is not a lowercase letter, digit or underscore; replaced in keys. */
const INVALID_KEY_CHARS = /[^a-z0-9_]/g

// Importance level labels
const IMPORTANCE_LABELS: Record<number, string> = {
  1: "Very Low",
  2: "Low",
  3: "Medium",
  4: "High",
  5: "Critical",
}

interface MemoryManagerProps {
  /** Additional className for the container */
  className?: string
}

/**
 * MemoryManager - Settings page component to manage AI memories
 *
 * Provides full CRUD functionality for AI memories:
 * - List all memories with categories and importance
 * - Create new memories manually
 * - Edit existing memories
 * - Delete memories (with confirmation)
 * - View capacity usage
 */
const MemoryManager: React.FC<MemoryManagerProps> = ({ className }) => {
  const { memories, capacity, isLoading, createMemory, updateMemory, deleteMemory } = useMemories()

  // Form state for creating/editing memories
  const [showForm, setShowForm] = useState(false)
  const [editingMemory, setEditingMemory] = useState<MemoryWithMeta | null>(null)
  const [formKey, setFormKey] = useState("")
  const [formContent, setFormContent] = useState("")
  const [formCategory, setFormCategory] = useState<MemoryCategory>(MemoryCategory.FACT)
  const [formImportance, setFormImportance] = useState(3)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Delete confirmation
  const [memoryToDelete, setMemoryToDelete] = useState<MemoryWithMeta | null>(null)

  // Filter state lives in the URL (?memoryCategory=…), derived on every render
  const searchParams = useSearchParams()
  const requestedCategory = searchParams.get(FILTER_PARAM)
  const filterCategory: MemoryCategory | "ALL" =
    requestedCategory && isMemoryCategory(requestedCategory) ? requestedCategory : "ALL"

  const setFilterCategory = useCallback((category: MemoryCategory | "ALL") => {
    const params = new URLSearchParams(window.location.search)
    if (category === "ALL") {
      params.delete(FILTER_PARAM)
    } else {
      params.set(FILTER_PARAM, category)
    }
    const query = params.toString()
    // Native replaceState integrates with the App Router (useSearchParams updates)
    // without a server round trip, matching how the profile page syncs its tab.
    window.history.replaceState(null, "", `${window.location.pathname}${query ? `?${query}` : ""}`)
  }, [])

  const resetForm = useCallback(() => {
    setShowForm(false)
    setEditingMemory(null)
    setFormKey("")
    setFormContent("")
    setFormCategory(MemoryCategory.FACT)
    setFormImportance(3)
  }, [])

  const handleEditClick = useCallback((memory: MemoryWithMeta) => {
    setEditingMemory(memory)
    setFormKey(memory.key)
    setFormContent(memory.content)
    setFormCategory(memory.category)
    setFormImportance(memory.importance)
    setShowForm(true)
  }, [])

  const handleSubmit = useCallback(async () => {
    if (!formKey.trim() || !formContent.trim()) return

    setIsSubmitting(true)

    try {
      let result
      if (editingMemory) {
        // Update existing memory — key is fixed, only content/category/importance change
        result = await updateMemory(editingMemory.key, {
          content: formContent.trim(),
          category: formCategory,
          importance: formImportance,
        })
      } else {
        result = await createMemory(
          formKey.trim().toLowerCase().replace(INVALID_KEY_CHARS, "_"),
          formContent.trim(),
          {
            category: formCategory,
            importance: formImportance,
          }
        )
      }

      if (result) {
        resetForm()
      }
    } finally {
      setIsSubmitting(false)
    }
  }, [
    formKey,
    formContent,
    formCategory,
    formImportance,
    editingMemory,
    createMemory,
    updateMemory,
    resetForm,
  ])

  const handleDelete = useCallback(async () => {
    if (!memoryToDelete) return

    await deleteMemory(memoryToDelete.key)
    setMemoryToDelete(null)
  }, [memoryToDelete, deleteMemory])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && e.ctrlKey && formKey.trim() && formContent.trim()) {
        e.preventDefault()
        void handleSubmit()
      } else if (e.key === "Escape") {
        resetForm()
      }
    },
    [formKey, formContent, handleSubmit, resetForm]
  )

  // Filter memories by category
  const filteredMemories =
    filterCategory === "ALL" ? memories : memories.filter((m) => m.category === filterCategory)

  // Per-category counts in one pass over the list, not one filter per category
  const categoryCounts = useMemo(() => {
    const counts = new Map<MemoryCategory, number>()
    for (const memory of memories) {
      counts.set(memory.category, (counts.get(memory.category) ?? 0) + 1)
    }
    return counts
  }, [memories])

  return (
    <div className={cn("space-y-6", className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">AI Memory</h2>
          <p className="text-sm text-muted-foreground">
            Information the AI remembers about you across conversations
          </p>
        </div>
        {!showForm && (
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            disabled={capacity !== null && capacity.remaining <= 0}
          >
            <HiPlus className="size-4" aria-hidden="true" />
            Add Memory
          </button>
        )}
      </div>

      {/* Capacity indicator */}
      {capacity && (
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Memory Usage</span>
            <span className="font-medium tabular-nums text-foreground">
              {capacity.current} / {capacity.limit}
            </span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
            <div
              className={cn(
                "h-full w-full origin-left rounded-full transition-transform",
                capacity.remaining <= 5
                  ? "bg-destructive"
                  : capacity.remaining <= 15
                    ? "bg-yellow-500"
                    : "bg-primary"
              )}
              style={{ transform: `scaleX(${Math.min(capacity.current / capacity.limit, 1)})` }}
            />
          </div>
          {capacity.remaining <= 5 && (
            <p className="mt-2 flex items-center gap-1 text-xs text-destructive">
              <HiOutlineExclamationCircle className="size-4" aria-hidden="true" />
              {capacity.remaining === 0
                ? "Memory limit reached. Delete some memories or upgrade to PRO."
                : `Only ${capacity.remaining} slots remaining.`}
            </p>
          )}
        </div>
      )}

      {/* Create/Edit Form */}
      {showForm && (
        <div className="rounded-lg border border-border bg-card p-4">
          <h3 className="mb-4 text-sm font-medium text-foreground">
            {editingMemory ? "Edit Memory" : "Add New Memory"}
          </h3>

          <div className="space-y-4">
            {/* Key input */}
            <div>
              <label
                htmlFor="memory-key"
                className="mb-1 block text-sm font-medium text-foreground"
              >
                Key
              </label>
              {/* autoFocus: the form opens on an explicit Add/Edit click; first field. */}
              <input
                id="memory-key"
                name="memoryKey"
                type="text"
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
                translate="no"
                value={formKey}
                onChange={(e) =>
                  setFormKey(e.target.value.toLowerCase().replace(INVALID_KEY_CHARS, "_"))
                }
                onKeyDown={handleKeyDown}
                placeholder="e.g., preferred_language, current_project…"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                maxLength={100}
                autoFocus
                disabled={!!editingMemory}
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Unique identifier (lowercase, underscores only)
              </p>
            </div>

            {/* Content input */}
            <div>
              <label
                htmlFor="memory-content"
                className="mb-1 block text-sm font-medium text-foreground"
              >
                Content
              </label>
              <textarea
                id="memory-content"
                name="memoryContent"
                autoComplete="off"
                value={formContent}
                onChange={(e) => setFormContent(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="e.g., Prefers short, direct answers…"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                rows={3}
                maxLength={500}
              />
              <p className="mt-1 text-xs tabular-nums text-muted-foreground">
                {formContent.length}/500 characters
              </p>
            </div>

            {/* Category picker */}
            <fieldset>
              <legend className="mb-2 block text-sm font-medium text-foreground">Category</legend>
              <div className="flex flex-wrap gap-2">
                {CATEGORY_KEYS.map((category) => {
                  const style = CATEGORY_STYLES[category]
                  return (
                    <button
                      key={category}
                      type="button"
                      onClick={() => setFormCategory(category)}
                      aria-pressed={formCategory === category}
                      className={cn(
                        "rounded-md border px-3 py-1.5 text-sm transition",
                        style.bg,
                        style.text,
                        style.border,
                        formCategory === category && "ring-2 ring-ring ring-offset-2"
                      )}
                      aria-label={`Select ${style.label} category`}
                    >
                      {style.label}
                    </button>
                  )
                })}
              </div>
            </fieldset>

            {/* Importance slider */}
            <div>
              <label
                htmlFor="memory-importance"
                className="mb-2 block text-sm font-medium text-foreground"
              >
                Importance: {IMPORTANCE_LABELS[formImportance]} ({formImportance}/5)
              </label>
              <input
                id="memory-importance"
                name="importance"
                type="range"
                min={1}
                max={5}
                value={formImportance}
                onChange={(e) => setFormImportance(parseInt(e.target.value))}
                className="w-full"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Higher importance memories are prioritized in AI context
              </p>
            </div>

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
                disabled={!formKey.trim() || !formContent.trim() || isSubmitting}
                className="flex-1 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
              >
                {isSubmitting
                  ? editingMemory
                    ? "Updating…"
                    : "Creating…"
                  : editingMemory
                    ? "Update Memory"
                    : "Add Memory"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Filter by category */}
      {memories.length > 0 && (
        <div
          className="flex flex-wrap items-center gap-2"
          role="group"
          aria-labelledby="memory-filter-label"
        >
          <span id="memory-filter-label" className="text-sm text-muted-foreground">
            Filter:
          </span>
          <button
            type="button"
            onClick={() => setFilterCategory("ALL")}
            aria-pressed={filterCategory === "ALL"}
            className={cn(
              "rounded-md px-3 py-1 text-sm transition-colors",
              filterCategory === "ALL"
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
            )}
          >
            All (<span className="tabular-nums">{memories.length}</span>)
          </button>
          {CATEGORY_KEYS.map((category) => {
            const count = categoryCounts.get(category) ?? 0
            if (count === 0) return null
            const style = CATEGORY_STYLES[category]
            return (
              <button
                key={category}
                type="button"
                onClick={() => setFilterCategory(category)}
                aria-pressed={filterCategory === category}
                className={cn(
                  "rounded-md px-3 py-1 text-sm transition-colors",
                  filterCategory === category ? "ring-2 ring-ring" : "hover:opacity-80",
                  style.bg,
                  style.text
                )}
              >
                {style.label} (<span className="tabular-nums">{count}</span>)
              </button>
            )
          })}
        </div>
      )}

      {/* Memories List */}
      {isLoading ? (
        <div className="py-8 text-center text-muted-foreground" role="status">
          <div
            className="mx-auto mb-2 size-8 animate-spin rounded-full border-2 border-muted border-t-primary"
            aria-hidden="true"
          />
          Loading memories…
        </div>
      ) : memories.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border py-12 text-center">
          <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-muted">
            <HiPlus className="size-6 text-muted-foreground" aria-hidden="true" />
          </div>
          <h3 className="mb-1 text-sm font-medium text-foreground">No Memories Yet</h3>
          <p className="mb-4 text-sm text-muted-foreground">
            Add memories to help the AI remember important information about you
          </p>
          {!showForm && (
            <button
              type="button"
              onClick={() => setShowForm(true)}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              <HiPlus className="size-4" aria-hidden="true" />
              Add Your First Memory
            </button>
          )}
        </div>
      ) : filteredMemories.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border py-8 text-center">
          <p className="text-sm text-muted-foreground">No memories in this category</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredMemories.map((memory) => {
            const categoryStyle = CATEGORY_STYLES[memory.category]
            return (
              <div
                key={memory.id}
                // Up to 200 memories on PRO: let the browser skip off-screen rows.
                className="rounded-lg border border-border bg-card p-4 transition-colors [contain-intrinsic-size:auto_120px] [content-visibility:auto] hover:bg-accent/50"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1 space-y-2">
                    {/* Key and category */}
                    <div className="flex flex-wrap items-center gap-2">
                      <code
                        className="break-all rounded bg-muted px-2 py-0.5 font-mono text-sm text-foreground"
                        translate="no"
                      >
                        {memory.key}
                      </code>
                      <span
                        className={cn(
                          "rounded-md border px-2 py-0.5 text-xs",
                          categoryStyle.bg,
                          categoryStyle.text,
                          categoryStyle.border
                        )}
                      >
                        {categoryStyle.label}
                      </span>
                      <span className="text-xs tabular-nums text-muted-foreground">
                        Importance: {memory.importance}/5
                      </span>
                    </div>

                    {/* Content */}
                    <p className="break-words text-sm text-foreground">{memory.content}</p>

                    {/* Metadata */}
                    <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                      <span>Updated {formatDate(memory.updatedAt)}</span>
                      {memory.expiresAt && (
                        <span className="flex items-center gap-1">
                          <HiOutlineClock className="size-3" aria-hidden="true" />
                          Expires {formatDate(memory.expiresAt)}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleEditClick(memory)}
                      className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                      title="Edit memory"
                      aria-label={`Edit memory ${memory.key}`}
                    >
                      <HiOutlinePencil className="size-4" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setMemoryToDelete(memory)}
                      className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                      title="Delete memory"
                      aria-label={`Delete memory ${memory.key}`}
                    >
                      <HiOutlineTrash className="size-4" aria-hidden="true" />
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!memoryToDelete} onOpenChange={() => setMemoryToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Memory</AlertDialogTitle>
            <AlertDialogDescription>
              Delete the memory &ldquo;<span translate="no">{memoryToDelete?.key}</span>&rdquo;? The
              AI will stop remembering this. You can&rsquo;t undo this.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete Memory
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

export default memo(MemoryManager)
