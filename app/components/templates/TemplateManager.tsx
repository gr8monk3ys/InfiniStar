"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Edit2, Plus, Search, Trash2 } from "lucide-react"

import { cn } from "@/app/lib/utils"
import { Badge } from "@/app/components/ui/badge"
import { Button } from "@/app/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/app/components/ui/dialog"
import { Label } from "@/app/components/ui/label"
import { Textarea } from "@/app/components/ui/textarea"
import { useTemplates } from "@/app/hooks/useTemplates"
import { TEMPLATE_CATEGORIES, TEMPLATE_CONSTRAINTS, type MessageTemplateType } from "@/app/types"

interface TemplateFormData {
  name: string
  content: string
  shortcut: string
  category: string
}

const defaultFormData: TemplateFormData = {
  name: "",
  content: "",
  shortcut: "",
  category: "",
}

type FormErrorField = "name" | "content" | null

interface FormError {
  /** The field the message belongs to, or null for a save failure. */
  field: FormErrorField
  message: string
}

interface TemplateManagerProps {
  isOpen: boolean
  onClose: () => void
  onSelectTemplate?: (template: MessageTemplateType) => void
}

export function TemplateManager({ isOpen, onClose, onSelectTemplate }: TemplateManagerProps) {
  const {
    templates,
    limitInfo,
    categories,
    predefinedCategories,
    isLoading,
    fetchTemplates,
    createTemplate,
    updateTemplate,
    deleteTemplate,
  } = useTemplates()

  const [searchQuery, setSearchQuery] = useState("")
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<MessageTemplateType | null>(null)
  const [formData, setFormData] = useState<TemplateFormData>(defaultFormData)
  const [formError, setFormError] = useState<FormError | null>(null)
  const nameInputRef = useRef<HTMLInputElement>(null)
  const contentInputRef = useRef<HTMLTextAreaElement>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)

  // Load templates when dialog opens
  useEffect(() => {
    if (isOpen) {
      void fetchTemplates()
    }
  }, [isOpen, fetchTemplates])

  // Filter templates based on search and category (query lower-cased once)
  const lowerQuery = searchQuery.toLowerCase()
  const filteredTemplates = templates.filter((template) => {
    const matchesSearch =
      !lowerQuery ||
      template.name.toLowerCase().includes(lowerQuery) ||
      template.content.toLowerCase().includes(lowerQuery) ||
      template.shortcut?.toLowerCase().includes(lowerQuery)

    const matchesCategory = !selectedCategory || template.category === selectedCategory

    return matchesSearch && matchesCategory
  })

  // All categories including user-created ones
  const allCategories = Array.from(new Set([...predefinedCategories, ...categories])).sort()

  const handleCreateNew = useCallback(() => {
    setFormData(defaultFormData)
    setEditingTemplate(null)
    setFormError(null)
    setIsEditing(true)
  }, [])

  const handleEdit = useCallback((template: MessageTemplateType) => {
    setFormData({
      name: template.name,
      content: template.content,
      shortcut: template.shortcut || "",
      category: template.category || "",
    })
    setEditingTemplate(template)
    setFormError(null)
    setIsEditing(true)
  }, [])

  const handleCancelEdit = useCallback(() => {
    setIsEditing(false)
    setEditingTemplate(null)
    setFormData(defaultFormData)
    setFormError(null)
  }, [])

  const handleSave = useCallback(async () => {
    setFormError(null)

    // Validate, then move focus to the first field that needs fixing
    if (!formData.name.trim()) {
      setFormError({ field: "name", message: "Give the template a name." })
      nameInputRef.current?.focus()
      return
    }
    if (!formData.content.trim()) {
      setFormError({ field: "content", message: "Write the message this template inserts." })
      contentInputRef.current?.focus()
      return
    }

    setIsSaving(true)

    try {
      const data = {
        name: formData.name.trim(),
        content: formData.content.trim(),
        shortcut: formData.shortcut.trim() || null,
        category: formData.category.trim() || null,
      }

      if (editingTemplate) {
        await updateTemplate(editingTemplate.id, data)
      } else {
        await createTemplate(data)
      }

      handleCancelEdit()
      void fetchTemplates()
    } catch (error) {
      setFormError({
        field: null,
        message: error instanceof Error ? error.message : "Couldn't save the template. Try again.",
      })
    } finally {
      setIsSaving(false)
    }
  }, [formData, editingTemplate, createTemplate, updateTemplate, handleCancelEdit, fetchTemplates])

  const handleDelete = useCallback(
    async (templateId: string) => {
      try {
        await deleteTemplate(templateId)
        setDeleteConfirmId(null)
        void fetchTemplates()
      } catch {
        // Error is handled in the hook
      }
    },
    [deleteTemplate, fetchTemplates]
  )

  const handleSelectTemplate = useCallback(
    (template: MessageTemplateType) => {
      if (onSelectTemplate) {
        onSelectTemplate(template)
        onClose()
      }
    },
    [onSelectTemplate, onClose]
  )

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="flex max-h-[80vh] max-w-2xl flex-col">
        <DialogHeader>
          <DialogTitle>Message Templates</DialogTitle>
          <DialogDescription>
            Create and manage reusable message templates for quick replies.
            {limitInfo && (
              <span className="ml-2 tabular-nums text-muted-foreground">
                ({limitInfo.current}/{limitInfo.limit} templates)
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        {isEditing ? (
          // Edit/Create Form
          <div className="flex-1 space-y-4 overflow-auto overscroll-contain py-4">
            <div className="space-y-2">
              <Label htmlFor="template-name">
                Name <span className="text-destructive">*</span>
              </Label>
              <input
                ref={nameInputRef}
                id="template-name"
                name="templateName"
                autoComplete="off"
                aria-invalid={formError?.field === "name" || undefined}
                aria-describedby={
                  formError?.field === "name" ? "template-name-error" : "template-name-count"
                }
                type="text"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                placeholder="e.g., Thank you message…"
                value={formData.name}
                onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                maxLength={TEMPLATE_CONSTRAINTS.NAME_MAX_LENGTH}
              />
              {formError?.field === "name" && (
                <p id="template-name-error" className="text-sm text-destructive" role="alert">
                  {formError.message}
                </p>
              )}
              <p id="template-name-count" className="text-xs tabular-nums text-muted-foreground">
                {formData.name.length}/{TEMPLATE_CONSTRAINTS.NAME_MAX_LENGTH} characters
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="template-content">
                Content <span className="text-destructive">*</span>
              </Label>
              <Textarea
                ref={contentInputRef}
                id="template-content"
                name="templateContent"
                autoComplete="off"
                aria-invalid={formError?.field === "content" || undefined}
                aria-describedby={
                  formError?.field === "content"
                    ? "template-content-error"
                    : "template-content-hint"
                }
                placeholder="Enter your template message…"
                value={formData.content}
                onChange={(e) => setFormData((prev) => ({ ...prev, content: e.target.value }))}
                maxLength={TEMPLATE_CONSTRAINTS.CONTENT_MAX_LENGTH}
                className="min-h-[120px]"
              />
              {formError?.field === "content" && (
                <p id="template-content-error" className="text-sm text-destructive" role="alert">
                  {formError.message}
                </p>
              )}
              <p id="template-content-hint" className="text-xs text-muted-foreground">
                <span className="tabular-nums">
                  {formData.content.length}/{TEMPLATE_CONSTRAINTS.CONTENT_MAX_LENGTH}
                </span>{" "}
                characters. Use <code translate="no">{"{{name}}"}</code>,{" "}
                <code translate="no">{"{{date}}"}</code>, <code translate="no">{"{{time}}"}</code>{" "}
                for dynamic values.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="template-shortcut">Shortcut (optional)</Label>
                <input
                  id="template-shortcut"
                  name="templateShortcut"
                  autoComplete="off"
                  autoCapitalize="none"
                  spellCheck={false}
                  translate="no"
                  type="text"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  placeholder="/thanks…"
                  value={formData.shortcut}
                  onChange={(e) => setFormData((prev) => ({ ...prev, shortcut: e.target.value }))}
                  maxLength={TEMPLATE_CONSTRAINTS.SHORTCUT_MAX_LENGTH}
                />
                <p className="text-xs text-muted-foreground">
                  Type this in chat to quickly insert the template
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="template-category">Category (optional)</Label>
                <select
                  id="template-category"
                  name="templateCategory"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  value={formData.category}
                  onChange={(e) => setFormData((prev) => ({ ...prev, category: e.target.value }))}
                >
                  <option value="">No category</option>
                  {TEMPLATE_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {formError && formError.field === null && (
              <p className="text-sm text-destructive" role="alert">
                {formError.message}
              </p>
            )}

            <DialogFooter className="pt-4">
              <Button variant="outline" onClick={handleCancelEdit} disabled={isSaving}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={isSaving}>
                {isSaving ? "Saving…" : editingTemplate ? "Update Template" : "Create Template"}
              </Button>
            </DialogFooter>
          </div>
        ) : (
          // Template List View
          <>
            <div className="flex items-center gap-2 py-2">
              <div className="relative flex-1">
                <Search
                  className="absolute left-2.5 top-2.5 size-4 text-muted-foreground"
                  aria-hidden="true"
                />
                <input
                  type="search"
                  name="templateSearch"
                  autoComplete="off"
                  aria-label="Search templates"
                  className="flex h-9 w-full rounded-md border border-input bg-background py-2 pl-8 pr-3 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  placeholder="Search templates…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <Button onClick={handleCreateNew} disabled={limitInfo?.isLimitReached} size="sm">
                <Plus className="mr-1 size-4" aria-hidden="true" />
                New Template
              </Button>
            </div>

            {/* Category Filter */}
            <div className="flex flex-wrap gap-1 py-2">
              <Button
                variant={selectedCategory === null ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedCategory(null)}
                aria-pressed={selectedCategory === null}
                className="h-7 text-xs"
              >
                All
              </Button>
              {allCategories.map((cat) => (
                <Button
                  key={cat}
                  variant={selectedCategory === cat ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedCategory(cat)}
                  aria-pressed={selectedCategory === cat}
                  className="h-7 text-xs"
                >
                  {cat}
                </Button>
              ))}
            </div>

            {/* Template List */}
            <div className="max-h-[400px] min-h-[200px] flex-1 overflow-auto overscroll-contain rounded-md border">
              {isLoading ? (
                <div className="flex h-32 items-center justify-center">
                  <p className="text-muted-foreground">Loading templates…</p>
                </div>
              ) : filteredTemplates.length === 0 ? (
                <div className="flex h-32 flex-col items-center justify-center gap-2">
                  <p className="text-muted-foreground">
                    {templates.length === 0
                      ? "No templates yet. Create your first one!"
                      : "No templates match your search."}
                  </p>
                </div>
              ) : (
                <div className="divide-y">
                  {filteredTemplates.map((template) => (
                    // The row holds its own Edit/Delete buttons, so it cannot be a
                    // <button>; when selectable it gets button semantics and keys.
                    <div
                      key={template.id}
                      className={cn(
                        "p-3 transition-colors hover:bg-muted/50",
                        onSelectTemplate &&
                          "cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                      )}
                      role={onSelectTemplate ? "button" : undefined}
                      tabIndex={onSelectTemplate ? 0 : undefined}
                      aria-label={onSelectTemplate ? `Use template ${template.name}` : undefined}
                      onClick={() => onSelectTemplate && handleSelectTemplate(template)}
                      onKeyDown={(event) => {
                        if (!onSelectTemplate || event.target !== event.currentTarget) return
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault()
                          handleSelectTemplate(template)
                        }
                      }}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h4 className="min-w-0 truncate text-sm font-medium">
                              {template.name}
                            </h4>
                            {template.shortcut && (
                              <Badge
                                variant="secondary"
                                className="font-mono text-xs"
                                translate="no"
                              >
                                {template.shortcut}
                              </Badge>
                            )}
                            {template.category && (
                              <Badge variant="outline" className="text-xs">
                                {template.category}
                              </Badge>
                            )}
                          </div>
                          <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                            {template.content}
                          </p>
                          <p className="mt-1 text-xs tabular-nums text-muted-foreground">
                            Used {template.usageCount} time{template.usageCount !== 1 && "s"}
                          </p>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleEdit(template)
                            }}
                            aria-label={`Edit template ${template.name}`}
                          >
                            <Edit2 className="size-4" aria-hidden="true" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation()
                              setDeleteConfirmId(template.id)
                            }}
                            aria-label={`Delete template ${template.name}`}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="size-4" aria-hidden="true" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {limitInfo && !limitInfo.isPro && limitInfo.isLimitReached && (
              <p className="text-sm text-amber-600">
                Template limit reached. Upgrade to PRO for up to 100 templates.
              </p>
            )}
          </>
        )}
      </DialogContent>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteConfirmId} onOpenChange={() => setDeleteConfirmId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Template</DialogTitle>
            <DialogDescription>Delete this template? You can&rsquo;t undo this.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirmId(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteConfirmId && handleDelete(deleteConfirmId)}
            >
              Delete Template
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Dialog>
  )
}
