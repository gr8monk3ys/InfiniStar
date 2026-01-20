"use client"

import { useCallback, useEffect } from "react"
import { Clock, TrendingUp } from "lucide-react"

import { cn } from "@/app/lib/utils"
import { Badge } from "@/app/components/ui/badge"
import { Button } from "@/app/components/ui/button"
import { useTemplates } from "@/app/hooks/useTemplates"
import { type MessageTemplateType, type TemplateVariables } from "@/app/types"

interface QuickReplyBarProps {
  onSelectTemplate: (content: string, template: MessageTemplateType) => void
  variables?: TemplateVariables
  className?: string
  maxTemplates?: number
  showType?: "popular" | "recent" | "both"
}

export function QuickReplyBar({
  onSelectTemplate,
  variables,
  className,
  maxTemplates = 5,
  showType = "popular",
}: QuickReplyBarProps) {
  const {
    popularTemplates,
    recentTemplates,
    fetchPopularTemplates,
    fetchRecentTemplates,
    applyTemplate,
  } = useTemplates()

  // Fetch templates on mount
  useEffect(() => {
    if (showType === "popular" || showType === "both") {
      fetchPopularTemplates(maxTemplates)
    }
    if (showType === "recent" || showType === "both") {
      fetchRecentTemplates(maxTemplates)
    }
  }, [fetchPopularTemplates, fetchRecentTemplates, maxTemplates, showType])

  const handleSelectTemplate = useCallback(
    async (template: MessageTemplateType) => {
      const result = await applyTemplate(template.id, variables)
      if (result) {
        onSelectTemplate(result.content, template)
      } else {
        onSelectTemplate(template.content, template)
      }
    },
    [applyTemplate, variables, onSelectTemplate]
  )

  // Determine which templates to show
  const templates = showType === "recent" ? recentTemplates : popularTemplates
  const hasTemplates = templates.length > 0

  if (!hasTemplates) {
    return null
  }

  return (
    <div className={cn("flex items-center gap-2 overflow-x-auto py-2", className)}>
      {/* Label */}
      <div className="flex items-center gap-1 whitespace-nowrap text-xs text-muted-foreground">
        {showType === "recent" ? (
          <>
            <Clock className="size-3" />
            <span>Recent:</span>
          </>
        ) : (
          <>
            <TrendingUp className="size-3" />
            <span>Quick:</span>
          </>
        )}
      </div>

      {/* Template Buttons */}
      <div className="flex items-center gap-1.5 overflow-x-auto">
        {templates.map((template) => (
          <Button
            key={template.id}
            variant="outline"
            size="sm"
            onClick={() => handleSelectTemplate(template)}
            className="h-7 shrink-0 whitespace-nowrap text-xs"
            title={template.content}
          >
            {template.name}
            {template.shortcut && (
              <Badge variant="secondary" className="ml-1.5 px-1 py-0 font-mono text-[10px]">
                {template.shortcut}
              </Badge>
            )}
          </Button>
        ))}
      </div>
    </div>
  )
}

/**
 * Compact version of QuickReplyBar that shows as chips
 */
interface QuickReplyChipsProps {
  onSelectTemplate: (content: string, template: MessageTemplateType) => void
  variables?: TemplateVariables
  className?: string
  maxTemplates?: number
}

export function QuickReplyChips({
  onSelectTemplate,
  variables,
  className,
  maxTemplates = 4,
}: QuickReplyChipsProps) {
  const { popularTemplates, fetchPopularTemplates, applyTemplate } = useTemplates()

  useEffect(() => {
    fetchPopularTemplates(maxTemplates)
  }, [fetchPopularTemplates, maxTemplates])

  const handleSelectTemplate = useCallback(
    async (template: MessageTemplateType) => {
      const result = await applyTemplate(template.id, variables)
      if (result) {
        onSelectTemplate(result.content, template)
      } else {
        onSelectTemplate(template.content, template)
      }
    },
    [applyTemplate, variables, onSelectTemplate]
  )

  if (popularTemplates.length === 0) {
    return null
  }

  return (
    <div className={cn("flex flex-wrap gap-1", className)}>
      {popularTemplates.map((template) => (
        <button
          key={template.id}
          onClick={() => handleSelectTemplate(template)}
          className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/80 hover:text-foreground"
          title={template.content}
        >
          {template.shortcut || template.name}
        </button>
      ))}
    </div>
  )
}
