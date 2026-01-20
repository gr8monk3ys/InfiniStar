"use client"

import { useCallback, useEffect, useState } from "react"
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
  const [formError, setFormError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)

  // Load templates when dialog opens
  useEffect(() => {
    if (isOpen) {
      fetchTemplates()
    }
  }, [isOpen, fetchTemplates])

  // Filter templates based on search and category
  const filteredTemplates = templates.filter((template) => {
    const matchesSearch =
      !searchQuery ||
      template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      template.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (template.shortcut && template.shortcut.toLowerCase().includes(searchQuery.toLowerCase()))

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

    // Validate
    if (!formData.name.trim()) {
      setFormError("Template name is required")
      return
    }
    if (!formData.content.trim()) {
      setFormError("Template content is required")
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
      fetchTemplates()
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Failed to save template")
    } finally {
      setIsSaving(false)
    }
  }, [formData, editingTemplate, createTemplate, updateTemplate, handleCancelEdit, fetchTemplates])

  const handleDelete = useCallback(
    async (templateId: string) => {
      try {
        await deleteTemplate(templateId)
        setDeleteConfirmId(null)
        fetchTemplates()
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
              <span className="ml-2 text-muted-foreground">
                ({limitInfo.current}/{limitInfo.limit} templates)
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        {isEditing ? (
          // Edit/Create Form
          <div className="flex-1 space-y-4 overflow-auto py-4">
            <div className="space-y-2">
              <Label htmlFor="template-name">
                Name <span className="text-destructive">*</span>
              </Label>
              <input
                id="template-name"
                type="text"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                placeholder="e.g., Thank you message"
                value={formData.name}
                onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                maxLength={TEMPLATE_CONSTRAINTS.NAME_MAX_LENGTH}
              />
              <p className="text-xs text-muted-foreground">
                {formData.name.length}/{TEMPLATE_CONSTRAINTS.NAME_MAX_LENGTH} characters
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="template-content">
                Content <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="template-content"
                placeholder="Enter your template message..."
                value={formData.content}
                onChange={(e) => setFormData((prev) => ({ ...prev, content: e.target.value }))}
                maxLength={TEMPLATE_CONSTRAINTS.CONTENT_MAX_LENGTH}
                className="min-h-[120px]"
              />
              <p className="text-xs text-muted-foreground">
                {formData.content.length}/{TEMPLATE_CONSTRAINTS.CONTENT_MAX_LENGTH} characters. Use{" "}
                {"{{name}}"}, {"{{date}}"}, {"{{time}}"} for dynamic values.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="template-shortcut">Shortcut (optional)</Label>
                <input
                  id="template-shortcut"
                  type="text"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  placeholder="/thanks"
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

            {formError && <p className="text-sm text-destructive">{formError}</p>}

            <DialogFooter className="pt-4">
              <Button variant="outline" onClick={handleCancelEdit} disabled={isSaving}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={isSaving}>
                {isSaving ? "Saving..." : editingTemplate ? "Update Template" : "Create Template"}
              </Button>
            </DialogFooter>
          </div>
        ) : (
          // Template List View
          <>
            <div className="flex items-center gap-2 py-2">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
                <input
                  type="text"
                  className="flex h-9 w-full rounded-md border border-input bg-background py-2 pl-8 pr-3 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  placeholder="Search templates..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <Button onClick={handleCreateNew} disabled={limitInfo?.isLimitReached} size="sm">
                <Plus className="mr-1 size-4" />
                New
              </Button>
            </div>

            {/* Category Filter */}
            <div className="flex flex-wrap gap-1 py-2">
              <Button
                variant={selectedCategory === null ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedCategory(null)}
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
                  className="h-7 text-xs"
                >
                  {cat}
                </Button>
              ))}
            </div>

            {/* Template List */}
            <div className="max-h-[400px] min-h-[200px] flex-1 overflow-auto rounded-md border">
              {isLoading ? (
                <div className="flex h-32 items-center justify-center">
                  <p className="text-muted-foreground">Loading templates...</p>
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
                    <div
                      key={template.id}
                      className={cn(
                        "p-3 transition-colors hover:bg-muted/50",
                        onSelectTemplate && "cursor-pointer"
                      )}
                      onClick={() => onSelectTemplate && handleSelectTemplate(template)}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h4 className="truncate text-sm font-medium">{template.name}</h4>
                            {template.shortcut && (
                              <Badge variant="secondary" className="font-mono text-xs">
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
                          <p className="mt-1 text-xs text-muted-foreground">
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
                            aria-label="Edit template"
                          >
                            <Edit2 className="size-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation()
                              setDeleteConfirmId(template.id)
                            }}
                            aria-label="Delete template"
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="size-4" />
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
            <DialogDescription>
              Are you sure you want to delete this template? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirmId(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteConfirmId && handleDelete(deleteConfirmId)}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Dialog>
  )
}
