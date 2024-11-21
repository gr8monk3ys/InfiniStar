"use client"

import { useCallback, useEffect, useState } from "react"
import { FileText, Search, Settings } from "lucide-react"

import { cn } from "@/app/lib/utils"
import { Badge } from "@/app/components/ui/badge"
import { Button } from "@/app/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/app/components/ui/dropdown-menu"
import { TemplateManager } from "@/app/components/templates/TemplateManager"
import { useTemplates } from "@/app/hooks/useTemplates"
import { type MessageTemplateType, type TemplateVariables } from "@/app/types"

interface TemplateSelectorProps {
  onSelectTemplate: (content: string, template: MessageTemplateType) => void
  variables?: TemplateVariables
  triggerClassName?: string
  showLabel?: boolean
}

export function TemplateSelector({
  onSelectTemplate,
  variables,
  triggerClassName,
  showLabel = false,
}: TemplateSelectorProps) {
  const {
    templates,
    popularTemplates,
    isLoading,
    fetchTemplates,
    fetchPopularTemplates,
    applyTemplate,
  } = useTemplates()

  const [isOpen, setIsOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [isManagerOpen, setIsManagerOpen] = useState(false)

  // Load data when dropdown opens
  useEffect(() => {
    if (isOpen) {
      fetchTemplates()
      fetchPopularTemplates(5)
    }
  }, [isOpen, fetchTemplates, fetchPopularTemplates])

  // Filter templates based on search
  const filteredTemplates = templates.filter(
    (template) =>
      !searchQuery ||
      template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      template.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (template.shortcut && template.shortcut.toLowerCase().includes(searchQuery.toLowerCase()))
  )

  const handleSelectTemplate = useCallback(
    async (template: MessageTemplateType) => {
      // Apply the template (increments usage count and gets processed content)
      const result = await applyTemplate(template.id, variables)
      if (result) {
        onSelectTemplate(result.content, template)
      } else {
        // Fallback to raw content if API call fails
        onSelectTemplate(template.content, template)
      }
      setIsOpen(false)
      setSearchQuery("")
    },
    [applyTemplate, variables, onSelectTemplate]
  )

  const handleOpenManager = useCallback(() => {
    setIsOpen(false)
    setIsManagerOpen(true)
  }, [])

  return (
    <>
      <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className={cn("gap-1.5", triggerClassName)}
            aria-label="Insert template"
          >
            <FileText className="size-4" />
            {showLabel && <span>Templates</span>}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-72">
          {/* Search */}
          <div className="p-2">
            <div className="relative">
              <Search className="absolute left-2 top-2 size-4 text-muted-foreground" />
              <input
                type="text"
                className="flex h-8 w-full rounded-md border border-input bg-background py-1 pl-8 pr-3 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                placeholder="Search templates..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          </div>

          <DropdownMenuSeparator />

          {/* Popular Templates */}
          {!searchQuery && popularTemplates.length > 0 && (
            <>
              <DropdownMenuLabel className="text-xs text-muted-foreground">
                Frequently Used
              </DropdownMenuLabel>
              {popularTemplates.slice(0, 3).map((template) => (
                <DropdownMenuItem
                  key={template.id}
                  onClick={() => handleSelectTemplate(template)}
                  className="flex flex-col items-start gap-1 py-2"
                >
                  <div className="flex w-full items-center gap-2">
                    <span className="truncate text-sm font-medium">{template.name}</span>
                    {template.shortcut && (
                      <Badge variant="secondary" className="ml-auto font-mono text-xs">
                        {template.shortcut}
                      </Badge>
                    )}
                  </div>
                  <span className="line-clamp-1 w-full text-xs text-muted-foreground">
                    {template.content}
                  </span>
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
            </>
          )}

          {/* All Templates */}
          <DropdownMenuLabel className="text-xs text-muted-foreground">
            {searchQuery ? "Search Results" : "All Templates"}
          </DropdownMenuLabel>

          <div className="max-h-48 overflow-auto">
            {isLoading ? (
              <div className="p-4 text-center text-sm text-muted-foreground">Loading...</div>
            ) : filteredTemplates.length === 0 ? (
              <div className="p-4 text-center text-sm text-muted-foreground">
                {templates.length === 0 ? "No templates yet" : "No templates found"}
              </div>
            ) : (
              filteredTemplates.map((template) => (
                <DropdownMenuItem
                  key={template.id}
                  onClick={() => handleSelectTemplate(template)}
                  className="flex flex-col items-start gap-1 py-2"
                >
                  <div className="flex w-full items-center gap-2">
                    <span className="truncate text-sm font-medium">{template.name}</span>
                    {template.shortcut && (
                      <Badge variant="secondary" className="ml-auto font-mono text-xs">
                        {template.shortcut}
                      </Badge>
                    )}
                  </div>
                  <span className="line-clamp-1 w-full text-xs text-muted-foreground">
                    {template.content}
                  </span>
                </DropdownMenuItem>
              ))
            )}
          </div>

          <DropdownMenuSeparator />

          {/* Manage Templates */}
          <DropdownMenuItem onClick={handleOpenManager}>
            <Settings className="mr-2 size-4" />
            Manage Templates
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Template Manager Dialog */}
      <TemplateManager
        isOpen={isManagerOpen}
        onClose={() => setIsManagerOpen(false)}
        onSelectTemplate={(template) => {
          handleSelectTemplate(template)
          setIsManagerOpen(false)
        }}
      />
    </>
  )
}
