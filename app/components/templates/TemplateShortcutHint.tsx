"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Command } from "lucide-react"

import { cn } from "@/app/lib/utils"
import { Badge } from "@/app/components/ui/badge"
import { useTemplates } from "@/app/hooks/useTemplates"
import { type MessageTemplateType, type TemplateVariables } from "@/app/types"

interface TemplateShortcutHintProps {
  inputValue: string
  onSelectTemplate: (content: string, template: MessageTemplateType) => void
  variables?: TemplateVariables
  className?: string
  maxSuggestions?: number
}

export function TemplateShortcutHint({
  inputValue,
  onSelectTemplate,
  variables,
  className,
  maxSuggestions = 5,
}: TemplateShortcutHintProps) {
  const { searchByShortcut, applyTemplate } = useTemplates()
  const [suggestions, setSuggestions] = useState<MessageTemplateType[]>([])
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [isVisible, setIsVisible] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Detect shortcut pattern in input
  useEffect(() => {
    const shortcutMatch = inputValue.match(/^\/([a-zA-Z0-9_-]*)$/)

    if (!shortcutMatch) {
      setIsVisible(false)
      setSuggestions([])
      setSelectedIndex(0)
      return
    }

    const shortcut = `/${shortcutMatch[1]}`

    // Debounce search
    const timeoutId = setTimeout(async () => {
      const results = await searchByShortcut(shortcut)
      setSuggestions(results.slice(0, maxSuggestions))
      setSelectedIndex(0)
      setIsVisible(results.length > 0)
    }, 150)

    return () => clearTimeout(timeoutId)
  }, [inputValue, searchByShortcut, maxSuggestions])

  const handleSelectTemplate = useCallback(
    async (template: MessageTemplateType) => {
      const result = await applyTemplate(template.id, variables)
      if (result) {
        onSelectTemplate(result.content, template)
      } else {
        onSelectTemplate(template.content, template)
      }
      setIsVisible(false)
      setSuggestions([])
    },
    [applyTemplate, variables, onSelectTemplate]
  )

  // Handle keyboard navigation
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!isVisible || suggestions.length === 0) return

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault()
          setSelectedIndex((prev) => (prev + 1) % suggestions.length)
          break
        case "ArrowUp":
          e.preventDefault()
          setSelectedIndex((prev) => (prev - 1 + suggestions.length) % suggestions.length)
          break
        case "Enter":
        case "Tab":
          e.preventDefault()
          handleSelectTemplate(suggestions[selectedIndex])
          break
        case "Escape":
          e.preventDefault()
          setIsVisible(false)
          break
      }
    },
    [isVisible, suggestions, selectedIndex, handleSelectTemplate]
  )

  // Add keyboard listener
  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [handleKeyDown])

  if (!isVisible || suggestions.length === 0) {
    return null
  }

  return (
    <div
      ref={containerRef}
      className={cn(
        "absolute bottom-full left-0 z-50 mb-1 w-full max-w-md overflow-hidden rounded-md border bg-popover shadow-md",
        className
      )}
      role="listbox"
      aria-label="Template suggestions"
    >
      {/* Header */}
      <div className="border-b bg-muted/50 px-3 py-2">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Command className="size-3" />
          <span>Template Shortcuts</span>
          <span className="ml-auto">
            <kbd className="rounded bg-muted px-1 text-[10px]">Tab</kbd>
            {" or "}
            <kbd className="rounded bg-muted px-1 text-[10px]">Enter</kbd>
            {" to insert"}
          </span>
        </div>
      </div>

      {/* Suggestions List */}
      <div className="max-h-48 overflow-auto">
        {suggestions.map((template, index) => (
          <button
            key={template.id}
            onClick={() => handleSelectTemplate(template)}
            onMouseEnter={() => setSelectedIndex(index)}
            className={cn(
              "flex w-full flex-col gap-0.5 px-3 py-2 text-left transition-colors",
              index === selectedIndex ? "bg-accent" : "hover:bg-muted/50"
            )}
            role="option"
            aria-selected={index === selectedIndex}
          >
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="font-mono text-xs">
                {template.shortcut}
              </Badge>
              <span className="text-sm font-medium">{template.name}</span>
            </div>
            <span className="line-clamp-1 text-xs text-muted-foreground">{template.content}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

/**
 * Inline hint that shows above the input when "/" is detected
 * More compact version for tighter spaces
 */
interface InlineShortcutHintProps {
  inputValue: string
  onSelectTemplate: (content: string, template: MessageTemplateType) => void
  variables?: TemplateVariables
}

export function InlineShortcutHint({
  inputValue,
  onSelectTemplate,
  variables,
}: InlineShortcutHintProps) {
  const { searchByShortcut, applyTemplate } = useTemplates()
  const [suggestion, setSuggestion] = useState<MessageTemplateType | null>(null)

  useEffect(() => {
    const shortcutMatch = inputValue.match(/^\/([a-zA-Z0-9_-]+)$/)

    if (!shortcutMatch) {
      setSuggestion(null)
      return
    }

    const shortcut = `/${shortcutMatch[1]}`

    const timeoutId = setTimeout(async () => {
      const results = await searchByShortcut(shortcut)
      // Only show if there's an exact match or single result
      if (results.length === 1 || results.some((t) => t.shortcut === shortcut)) {
        setSuggestion(results.find((t) => t.shortcut === shortcut) || results[0])
      } else {
        setSuggestion(null)
      }
    }, 200)

    return () => clearTimeout(timeoutId)
  }, [inputValue, searchByShortcut])

  const handleSelect = useCallback(async () => {
    if (!suggestion) return

    const result = await applyTemplate(suggestion.id, variables)
    if (result) {
      onSelectTemplate(result.content, suggestion)
    } else {
      onSelectTemplate(suggestion.content, suggestion)
    }
    setSuggestion(null)
  }, [suggestion, applyTemplate, variables, onSelectTemplate])

  if (!suggestion) {
    return null
  }

  return (
    <div className="flex items-center gap-2 px-2 py-1 text-xs text-muted-foreground">
      <span>Press</span>
      <kbd className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px]">Tab</kbd>
      <span>to insert:</span>
      <button onClick={handleSelect} className="font-medium text-foreground hover:underline">
        {suggestion.name}
      </button>
    </div>
  )
}
