"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import toast from "react-hot-toast"
import {
  HiClock,
  HiExclamationTriangle,
  HiEye,
  HiInformationCircle,
  HiTrash,
} from "react-icons/hi2"

import { api, ApiError, createLoadingToast } from "@/app/lib/api-client"
import { formatDateTime } from "@/app/lib/intl-format"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/app/components/ui/alert-dialog"

import { AutoDeletePreview } from "./AutoDeletePreview"
import { RetentionPeriodSelect } from "./RetentionPeriodSelect"

interface Tag {
  id: string
  name: string
  color: string
  conversationCount?: number
}

interface AutoDeleteSettingsData {
  autoDeleteEnabled: boolean
  autoDeleteAfterDays: number
  autoDeleteArchived: boolean
  autoDeleteExcludeTags: string[]
  lastAutoDeleteRun: string | null
}

interface ConversationPreview {
  id: string
  name: string | null
  isAI: boolean
  lastMessageAt: string
  messageCount: number
  isArchived: boolean
  tags: { id: string; name: string; color: string }[]
  daysSinceLastMessage: number
}

interface PreviewData {
  conversations: ConversationPreview[]
  totalCount: number
  settings: AutoDeleteSettingsData
}

/** Order-insensitive comparison of two tag-id lists, without mutating either. */
function hasSameIds(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false
  const ids = new Set(a)
  return b.every((id) => ids.has(id))
}

export function AutoDeleteSettings() {
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isPreviewOpen, setIsPreviewOpen] = useState(false)
  const [isPreviewLoading, setIsPreviewLoading] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [showConfirmation, setShowConfirmation] = useState(false)

  // Settings state
  const [enabled, setEnabled] = useState(false)
  const [retentionDays, setRetentionDays] = useState(30)
  const [includeArchived, setIncludeArchived] = useState(false)
  const [excludedTagIds, setExcludedTagIds] = useState<string[]>([])
  const [lastRunDate, setLastRunDate] = useState<string | null>(null)

  // Tags for exclusion selection
  const [tags, setTags] = useState<Tag[]>([])

  // Preview data
  const [previewData, setPreviewData] = useState<PreviewData | null>(null)

  // Last saved settings; unsaved changes are derived against these
  const [originalSettings, setOriginalSettings] = useState<AutoDeleteSettingsData | null>(null)

  // Fetch settings
  const fetchSettings = useCallback(async () => {
    try {
      const response = await api.get<{ settings: AutoDeleteSettingsData }>(
        "/api/settings/auto-delete",
        { showErrorToast: false }
      )

      const settings = response.settings
      setEnabled(settings.autoDeleteEnabled)
      setRetentionDays(settings.autoDeleteAfterDays)
      setIncludeArchived(settings.autoDeleteArchived)
      setExcludedTagIds(settings.autoDeleteExcludeTags)
      setLastRunDate(settings.lastAutoDeleteRun)
      setOriginalSettings(settings)
    } catch (error) {
      console.error("Error fetching auto-delete settings:", error)
    }
  }, [])

  // Fetch user's tags
  const fetchTags = useCallback(async () => {
    try {
      const response = await api.get<{ tags: Tag[] }>("/api/tags", {
        showErrorToast: false,
      })
      setTags(response.tags)
    } catch (error) {
      console.error("Error fetching tags:", error)
    }
  }, [])

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true)
      await Promise.all([fetchSettings(), fetchTags()])
      setIsLoading(false)
    }
    void loadData()
  }, [fetchSettings, fetchTags])

  // Derived during render: no extra state, no effect, and no in-place sort of
  // the state arrays (the old `.sort()` mutated both of them).
  const hasChanges =
    originalSettings !== null &&
    (enabled !== originalSettings.autoDeleteEnabled ||
      retentionDays !== originalSettings.autoDeleteAfterDays ||
      includeArchived !== originalSettings.autoDeleteArchived ||
      !hasSameIds(excludedTagIds, originalSettings.autoDeleteExcludeTags))

  const excludedTagIdSet = useMemo(() => new Set(excludedTagIds), [excludedTagIds])

  // Warn before leaving the page with unsaved settings
  useEffect(() => {
    if (!hasChanges) return
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
    }
    window.addEventListener("beforeunload", handleBeforeUnload)
    return () => window.removeEventListener("beforeunload", handleBeforeUnload)
  }, [hasChanges])

  // Save settings
  const handleSave = async () => {
    // If enabling for the first time, show confirmation
    if (enabled && !originalSettings?.autoDeleteEnabled && !showConfirmation) {
      setShowConfirmation(true)
      return
    }

    setIsSaving(true)
    const loader = createLoadingToast("Saving auto-delete settings…")

    try {
      const response = await api.patch<{ message: string; settings: AutoDeleteSettingsData }>(
        "/api/settings/auto-delete",
        {
          autoDeleteEnabled: enabled,
          autoDeleteAfterDays: retentionDays,
          autoDeleteArchived: includeArchived,
          autoDeleteExcludeTags: excludedTagIds,
        },
        { showErrorToast: false }
      )

      loader.success(response.message)
      setOriginalSettings(response.settings)
      setShowConfirmation(false)
    } catch (error) {
      const message =
        error instanceof ApiError
          ? error.message
          : "Couldn't save your settings. Check your connection and try again."
      loader.error(message)
    } finally {
      setIsSaving(false)
    }
  }

  // Cancel enabling confirmation
  const handleCancelConfirmation = () => {
    setShowConfirmation(false)
    setEnabled(false)
  }

  // Load preview
  const handlePreview = async () => {
    setIsPreviewLoading(true)

    try {
      const response = await api.post<{ preview: PreviewData }>(
        "/api/settings/auto-delete/preview",
        {},
        { showErrorToast: false }
      )

      setPreviewData(response.preview)
      setIsPreviewOpen(true)
    } catch (error) {
      const message =
        error instanceof ApiError
          ? error.message
          : "Couldn't load the preview. Check your connection and try again."
      toast.error(message)
    } finally {
      setIsPreviewLoading(false)
    }
  }

  // Run manual cleanup
  const handleRunNow = async () => {
    setIsDeleting(true)
    const loader = createLoadingToast("Running auto-delete cleanup…")

    try {
      const response = await api.post<{
        success: boolean
        message: string
        result: { deletedCount: number }
      }>("/api/settings/auto-delete/run", {}, { showErrorToast: false })

      loader.success(response.message)
      setIsPreviewOpen(false)
      setPreviewData(null)

      // Refresh settings to get updated last run date
      await fetchSettings()
    } catch (error) {
      const message =
        error instanceof ApiError
          ? error.message
          : "Couldn't run auto-delete. Check your connection and try again."
      loader.error(message)
    } finally {
      setIsDeleting(false)
    }
  }

  // Toggle tag exclusion
  const handleTagToggle = (tagId: string) => {
    setExcludedTagIds((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]
    )
  }

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-4 w-48 rounded bg-muted" />
        <div className="h-10 w-full rounded bg-muted" />
        <div className="h-4 w-32 rounded bg-muted" />
        <div className="h-10 w-full rounded bg-muted" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h3 className="text-lg font-medium text-foreground">Auto-Delete Conversations</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Automatically delete old conversations to keep your inbox clean and protect your privacy.
        </p>
      </div>

      {/* Enable/Disable Toggle */}
      <div className="rounded-lg border border-border bg-muted p-4">
        <div className="flex items-center justify-between">
          <div className="min-w-0 flex-1">
            <label
              htmlFor="autoDeleteEnabled"
              className="block text-sm font-medium text-foreground"
            >
              Enable Auto-Delete
            </label>
            <p className="mt-1 text-sm text-muted-foreground">
              When enabled, conversations older than the retention period will be automatically
              deleted.
            </p>
          </div>
          <button
            type="button"
            id="autoDeleteEnabled"
            role="switch"
            aria-checked={enabled}
            onClick={() => setEnabled((current) => !current)}
            disabled={isSaving}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${
              enabled ? "bg-primary" : "bg-muted-foreground/30"
            }`}
          >
            <span className="sr-only">Enable auto-delete</span>
            <span
              className={`pointer-events-none inline-block size-5 rounded-full bg-background shadow ring-0 transition duration-200 ease-in-out ${
                enabled ? "translate-x-5" : "translate-x-0"
              }`}
            />
          </button>
        </div>
      </div>

      {/* Confirmation Dialog for First-Time Enable */}
      {showConfirmation && (
        <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4">
          <div className="flex items-start gap-3">
            <HiExclamationTriangle
              className="mt-0.5 size-5 shrink-0 text-yellow-600"
              aria-hidden="true"
            />
            <div className="min-w-0 flex-1">
              <h4 className="text-sm font-medium text-yellow-800">
                Confirm Auto-Delete Activation
              </h4>
              <p className="mt-1 text-sm text-yellow-700">
                Enabling auto-delete will permanently remove conversations older than{" "}
                <strong className="tabular-nums">{retentionDays} days</strong>. This action cannot
                be undone.
              </p>
              <p className="mt-2 text-sm text-yellow-700">
                We recommend previewing what would be deleted before confirming.
              </p>
              <div className="mt-4 flex gap-3">
                <button
                  type="button"
                  onClick={handlePreview}
                  disabled={isPreviewLoading || isSaving}
                  className="inline-flex items-center gap-2 rounded-md border border-yellow-300 bg-card px-3 py-1.5 text-sm font-medium text-yellow-800 hover:bg-yellow-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-500 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <HiEye className="size-4" aria-hidden="true" />
                  Preview Deletions
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={isSaving}
                  className="inline-flex items-center rounded-md bg-yellow-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-yellow-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-500 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isSaving ? "Saving…" : "Confirm & Enable"}
                </button>
                <button
                  type="button"
                  onClick={handleCancelConfirmation}
                  disabled={isSaving}
                  className="inline-flex items-center rounded-md border border-border bg-card px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Settings (only visible when enabled or has changes) */}
      {(enabled || originalSettings?.autoDeleteEnabled) && (
        <>
          {/* Retention Period */}
          <div>
            <label htmlFor="retentionPeriod" className="block text-sm font-medium text-foreground">
              Retention Period
            </label>
            <p className="mt-1 text-sm text-muted-foreground">
              Delete conversations with no activity for longer than this period.
            </p>
            <div className="mt-2 max-w-xs">
              <RetentionPeriodSelect
                id="retentionPeriod"
                value={retentionDays}
                onChange={setRetentionDays}
                disabled={isSaving}
              />
            </div>
          </div>

          {/* Include Archived */}
          <div className="flex items-center justify-between rounded-lg border border-border p-4">
            <div className="min-w-0 flex-1">
              <label
                htmlFor="includeArchived"
                className="block text-sm font-medium text-foreground"
              >
                Include Archived Conversations
              </label>
              <p className="mt-1 text-sm text-muted-foreground">
                When enabled, archived conversations will also be deleted after the retention
                period.
              </p>
            </div>
            <button
              type="button"
              id="includeArchived"
              role="switch"
              aria-checked={includeArchived}
              onClick={() => setIncludeArchived((current) => !current)}
              disabled={isSaving || !enabled}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${
                includeArchived && enabled ? "bg-primary" : "bg-muted-foreground/30"
              }`}
            >
              <span className="sr-only">Include archived conversations</span>
              <span
                className={`pointer-events-none inline-block size-5 rounded-full bg-background shadow ring-0 transition duration-200 ease-in-out ${
                  includeArchived && enabled ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>

          {/* Exclude Tags */}
          {tags.length > 0 && (
            <div role="group" aria-labelledby="excludeTagsLabel" aria-describedby="excludeTagsHint">
              <p id="excludeTagsLabel" className="block text-sm font-medium text-foreground">
                Exclude Tagged Conversations
              </p>
              <p id="excludeTagsHint" className="mt-1 text-sm text-muted-foreground">
                Conversations with these tags will never be auto-deleted.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {tags.map((tag) => {
                  const isExcluded = excludedTagIdSet.has(tag.id)
                  return (
                    <button
                      key={tag.id}
                      type="button"
                      onClick={() => handleTagToggle(tag.id)}
                      disabled={isSaving || !enabled}
                      className={`inline-flex max-w-full items-center rounded-full px-3 py-1.5 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${
                        isExcluded
                          ? "bg-primary/10 text-primary-accent ring-2 ring-primary"
                          : "bg-muted text-foreground hover:bg-muted/80"
                      }`}
                      aria-pressed={isExcluded}
                    >
                      <span
                        className="mr-1.5 size-2 shrink-0 rounded-full"
                        style={{ backgroundColor: tag.color }}
                        aria-hidden="true"
                      />
                      <span className="truncate">{tag.name}</span>
                      {isExcluded ? (
                        <span className="ml-1.5 text-primary" aria-hidden="true">
                          &#10003;
                        </span>
                      ) : null}
                    </button>
                  )
                })}
              </div>
              {excludedTagIds.length > 0 && (
                <p className="mt-2 text-xs tabular-nums text-muted-foreground">
                  {excludedTagIds.length} tag{excludedTagIds.length === 1 ? "" : "s"} excluded from
                  auto-delete
                </p>
              )}
            </div>
          )}

          {/* Last Run Info */}
          {lastRunDate && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <HiClock className="size-4" aria-hidden="true" />
              <span>Last auto-delete run: {formatDateTime(lastRunDate)}</span>
            </div>
          )}

          {/* Info Box */}
          <div className="rounded-lg border border-primary/20 bg-primary/10 p-4">
            <div className="flex items-start gap-3">
              <HiInformationCircle
                className="mt-0.5 size-5 shrink-0 text-primary"
                aria-hidden="true"
              />
              <div className="text-sm text-primary-accent">
                <p className="font-medium">How Auto-Delete Works</p>
                <ul className="mt-2 list-inside list-disc space-y-1">
                  <li>
                    Conversations are deleted based on their last message date, not creation date
                  </li>
                  <li>Deleted conversations and their messages are permanently removed</li>
                  <li>You can run cleanup manually once per hour using the button below</li>
                  <li>
                    <strong>Note:</strong> Set up a cron job for automatic scheduled cleanup
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Actions */}
      <div className="flex flex-col gap-3 border-t border-border pt-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-3">
          {enabled && (
            <>
              <button
                type="button"
                onClick={handlePreview}
                disabled={isPreviewLoading || isSaving}
                className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-4 py-2 text-sm font-medium text-foreground shadow-sm hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <HiEye className="size-4" aria-hidden="true" />
                {isPreviewLoading ? "Loading…" : "Preview Deletions"}
              </button>
              {/* Deleting is permanent, so running it asks first */}
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <button
                    type="button"
                    disabled={isDeleting || isSaving}
                    className="inline-flex items-center gap-2 rounded-md border border-destructive/30 bg-card px-4 py-2 text-sm font-medium text-destructive shadow-sm hover:bg-destructive/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <HiTrash className="size-4" aria-hidden="true" />
                    {isDeleting ? "Deleting…" : "Run Now"}
                  </button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Run Auto-Delete Now?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This permanently deletes every conversation that matches your saved
                      auto-delete settings. You can&apos;t undo this. Preview the deletions first if
                      you&apos;re not sure.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => void handleRunNow()}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Delete Conversations
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </>
          )}
        </div>
        {!showConfirmation && (
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving || !hasChanges}
            aria-busy={isSaving}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSaving ? "Saving…" : "Save Changes"}
          </button>
        )}
      </div>

      {/* Preview Modal */}
      {previewData && (
        <AutoDeletePreview
          isOpen={isPreviewOpen}
          onClose={() => setIsPreviewOpen(false)}
          conversations={previewData.conversations}
          totalCount={previewData.totalCount}
          retentionDays={retentionDays}
          onConfirmDelete={handleRunNow}
          isDeleting={isDeleting}
        />
      )}
    </div>
  )
}

export default AutoDeleteSettings
