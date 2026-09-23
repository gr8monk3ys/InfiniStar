"use client"

import { useCallback, useEffect, useEffectEvent, useState } from "react"
import { Command } from "lucide-react"

import { cn } from "@/app/lib/utils"
import { Badge } from "@/app/components/ui/badge"
import { useTemplates } from "@/app/hooks/useTemplates"
import { type MessageTemplateType, type TemplateVariables } from "@/app/types"

// "/" alone opens the full list; the inline hint needs at least one character.
const SHORTCUT_PREFIX_PATTERN = /^\/([a-zA-Z0-9_-]*)$/
const SHORTCUT_PATTERN = /^\/([a-zA-Z0-9_-]+)$/

/** The shortcut typed in the input ("/thx"), or null when the input is not one. */
function readShortcut(inputValue: string, pattern: RegExp): string | null {
  const match = pattern.exec(inputValue)
  return match ? `/${match[1]}` : null
}

/**
 * Whether a lookup made for `answered` still applies to what is typed now. While
 * the user keeps typing (or backspacing) the same shortcut, the previous results
 * stay up until the debounced lookup replaces them, so the list does not flicker.
 */
function isSameShortcutRun(answered: string, typed: string | null): boolean {
  return typed !== null && (typed.startsWith(answered) || answered.startsWith(typed))
}

interface TemplateShortcutHintProps {
  inputValue: string
  onSelectTemplate: (content: string, template: MessageTemplateType) => void
  variables?: TemplateVariables
  className?: string
  maxSuggestions?: number
}

/**
 * Lookup results are kept together with the shortcut they answer. Whether the
 * list shows is then derived during render from the current input, instead of
 * an effect resetting state every time the input stops being a shortcut.
 */
interface ShortcutLookup {
  shortcut: string
  suggestions: MessageTemplateType[]
  selectedIndex: number
  dismissed: boolean
}

export function TemplateShortcutHint({
  inputValue,
  onSelectTemplate,
  variables,
  className,
  maxSuggestions = 5,
}: TemplateShortcutHintProps) {
  const { searchByShortcut, applyTemplate } = useTemplates()
  const [lookup, setLookup] = useState<ShortcutLookup | null>(null)

  const shortcut = readShortcut(inputValue, SHORTCUT_PREFIX_PATTERN)

  // Debounced lookup whenever the typed shortcut changes
  useEffect(() => {
    if (!shortcut) return

    // setTimeout expects a void callback, so the async work is voided with a
    // rejection handler — a failed lookup should just leave the hint hidden,
    // not raise an unhandled rejection.
    const timeoutId = setTimeout(() => {
      void searchByShortcut(shortcut)
        .then((results) => {
          setLookup({
            shortcut,
            suggestions: results.slice(0, maxSuggestions),
            selectedIndex: 0,
            dismissed: false,
          })
        })
        .catch(() => {
          setLookup(null)
        })
    }, 150)

    return () => clearTimeout(timeoutId)
  }, [shortcut, searchByShortcut, maxSuggestions])

  const suggestions =
    lookup && !lookup.dismissed && isSameShortcutRun(lookup.shortcut, shortcut)
      ? lookup.suggestions
      : []
  const isVisible = suggestions.length > 0
  const selectedIndex = lookup?.selectedIndex ?? 0

  const setSelectedIndex = useCallback((update: (index: number, count: number) => number) => {
    setLookup((current) =>
      current
        ? {
            ...current,
            selectedIndex: update(current.selectedIndex, current.suggestions.length),
          }
        : current
    )
  }, [])

  const handleSelectTemplate = useCallback(
    async (template: MessageTemplateType) => {
      const result = await applyTemplate(template.id, variables)
      if (result) {
        onSelectTemplate(result.content, template)
      } else {
        onSelectTemplate(template.content, template)
      }
      setLookup(null)
    },
    [applyTemplate, variables, onSelectTemplate]
  )

  // Keyboard navigation. An Effect Event reads the latest list and selection,
  // so the document listener is added once instead of on every highlight move.
  const handleKeyDown = useEffectEvent((e: KeyboardEvent) => {
    if (!isVisible) return

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault()
        setSelectedIndex((index, count) => (index + 1) % count)
        break
      case "ArrowUp":
        e.preventDefault()
        setSelectedIndex((index, count) => (index - 1 + count) % count)
        break
      case "Enter":
      case "Tab":
        e.preventDefault()
        void handleSelectTemplate(suggestions[selectedIndex])
        break
      case "Escape":
        e.preventDefault()
        setLookup((current) => (current ? { ...current, dismissed: true } : current))
        break
    }
  })

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [])

  if (!isVisible) {
    return null
  }

  return (
    <div
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
          <Command className="size-3" aria-hidden="true" />
          <span>Template Shortcuts</span>
          <span className="ml-auto">
            <kbd className="rounded bg-muted px-1 text-xs">Tab</kbd>
            {" or "}
            <kbd className="rounded bg-muted px-1 text-xs">Enter</kbd>
            {" to insert"}
          </span>
        </div>
      </div>

      {/* Suggestions List */}
      <div className="max-h-48 overflow-auto overscroll-contain">
        {suggestions.map((template, index) => (
          <button
            key={template.id}
            type="button"
            onClick={() => handleSelectTemplate(template)}
            onMouseEnter={() => setSelectedIndex(() => index)}
            className={cn(
              "flex w-full flex-col gap-0.5 px-3 py-2 text-left transition-colors",
              index === selectedIndex ? "bg-accent" : "hover:bg-muted/50"
            )}
            role="option"
            aria-selected={index === selectedIndex}
          >
            <div className="flex min-w-0 items-center gap-2">
              <Badge variant="secondary" className="font-mono text-xs" translate="no">
                {template.shortcut}
              </Badge>
              <span className="truncate text-sm font-medium">{template.name}</span>
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
  // The match is stored with the shortcut it answers; see ShortcutLookup above.
  const [match, setMatch] = useState<{
    shortcut: string
    template: MessageTemplateType | null
  } | null>(null)

  const shortcut = readShortcut(inputValue, SHORTCUT_PATTERN)

  useEffect(() => {
    if (!shortcut) return

    const timeoutId = setTimeout(() => {
      void searchByShortcut(shortcut)
        .then((results) => {
          // Only show if there's an exact match or single result
          const exact = results.find((t) => t.shortcut === shortcut)
          setMatch({
            shortcut,
            template: exact ?? (results.length === 1 ? results[0] : null),
          })
        })
        .catch(() => {
          setMatch(null)
        })
    }, 200)

    return () => clearTimeout(timeoutId)
  }, [shortcut, searchByShortcut])

  const suggestion = match && isSameShortcutRun(match.shortcut, shortcut) ? match.template : null

  const handleSelect = useCallback(async () => {
    if (!suggestion) return

    const result = await applyTemplate(suggestion.id, variables)
    if (result) {
      onSelectTemplate(result.content, suggestion)
    } else {
      onSelectTemplate(suggestion.content, suggestion)
    }
    setMatch(null)
  }, [suggestion, applyTemplate, variables, onSelectTemplate])

  if (!suggestion) {
    return null
  }

  return (
    <div className="flex items-center gap-2 px-2 py-1 text-xs text-muted-foreground">
      <span>Press</span>
      <kbd className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">Tab</kbd>
      <span>to insert:</span>
      <button
        type="button"
        onClick={handleSelect}
        className="font-medium text-foreground hover:underline"
      >
        {suggestion.name}
      </button>
    </div>
  )
}
