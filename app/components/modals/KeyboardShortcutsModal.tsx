"use client"

import { useEffect, useMemo, useRef } from "react"
import { HiOutlineXMark } from "react-icons/hi2"

import { shortcuts, type ShortcutAction, type ShortcutGroup } from "@/app/lib/shortcuts"

interface KeyboardShortcutsModalProps {
  isOpen: boolean
  onClose: () => void
}

/**
 * Single keyboard key display component
 */
function KeyboardKey({ children }: { children: React.ReactNode }) {
  return (
    <kbd
      className="inline-flex min-w-[24px] items-center justify-center rounded border-border bg-muted px-2 py-1 text-xs font-medium text-foreground shadow-sm"
      aria-hidden="true"
    >
      {children}
    </kbd>
  )
}

/**
 * Shortcut display component
 */
function ShortcutDisplay({ action }: { action: ShortcutAction }) {
  const formatted = shortcuts.display(action.defaultBinding)
  const parts = formatted.split("+")

  return (
    <div className="flex items-center gap-1">
      {parts.map((part, partIndex) => {
        // Use action.id + part as key since parts are derived from static config
        const uniqueKey = `${action.id}-part-${part}`
        return (
          <span key={uniqueKey} className="flex items-center gap-1">
            {partIndex > 0 && <span className="text-muted-foreground/70">+</span>}
            <KeyboardKey>{part}</KeyboardKey>
          </span>
        )
      })}
    </div>
  )
}

/**
 * Shortcut row component
 */
function ShortcutRow({ action }: { action: ShortcutAction }) {
  return (
    <div className="flex items-center justify-between py-2">
      <div className="flex flex-col">
        <span className="text-sm font-medium text-foreground">{action.name}</span>
        <span className="text-xs text-muted-foreground">{action.description}</span>
      </div>
      <ShortcutDisplay action={action} />
    </div>
  )
}

/**
 * Category section component
 */
function CategorySection({ group }: { group: ShortcutGroup }) {
  if (group.shortcuts.length === 0) return null

  return (
    <div className="mb-6 last:mb-0">
      <div className="mb-3">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-foreground/80">
          {group.label}
        </h3>
        {group.description && (
          <p className="text-xs text-muted-foreground">{group.description}</p>
        )}
      </div>
      <div className="divide-y divide-border rounded-lg border border-border bg-card">
        <div className="px-4">
          {group.shortcuts.map((shortcut) => (
            <ShortcutRow key={shortcut.id} action={shortcut} />
          ))}
        </div>
      </div>
    </div>
  )
}

/**
 * KeyboardShortcutsModal Component
 *
 * Displays all available keyboard shortcuts grouped by category.
 * Features a clean, accessible UI with keyboard icons and descriptions.
 *
 * Can be opened with:
 * - Cmd/Ctrl + / (slash key)
 * - ? (question mark key)
 */
const KeyboardShortcutsModal: React.FC<KeyboardShortcutsModalProps> = ({ isOpen, onClose }) => {
  const modalRef = useRef<HTMLDivElement>(null)
  const modifierKey = useMemo(() => shortcuts.platform().modifierKey, [])

  // Shortcuts grouped by category, already ordered for display
  const groups = useMemo(() => shortcuts.groups().filter((g) => g.shortcuts.length > 0), [])

  // Handle escape key to close
  useEffect(() => {
    if (!isOpen) return

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault()
        onClose()
      }
    }

    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [isOpen, onClose])

  // Focus trap and initial focus
  useEffect(() => {
    if (isOpen && modalRef.current) {
      const focusableElements = modalRef.current.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      )
      const firstElement = focusableElements[0] as HTMLElement
      firstElement?.focus()
    }
  }, [isOpen])

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden"
    } else {
      document.body.style.overflow = ""
    }
    return () => {
      document.body.style.overflow = ""
    }
  }, [isOpen])

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-scrim/70 pt-16"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="keyboard-shortcuts-title"
    >
      <div
        ref={modalRef}
        className="relative mx-4 mb-8 w-full max-w-xl rounded-lg bg-background shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border p-4">
          <div>
            <h2 id="keyboard-shortcuts-title" className="text-lg font-semibold text-foreground">
              Keyboard Shortcuts
            </h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Press <KeyboardKey>{modifierKey}</KeyboardKey>
              <span className="mx-1 text-muted-foreground/70">+</span>
              <KeyboardKey>/</KeyboardKey> or <KeyboardKey>?</KeyboardKey> to toggle this panel
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-2 text-muted-foreground/70 transition hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            aria-label="Close keyboard shortcuts panel"
          >
            <HiOutlineXMark size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="max-h-[60vh] overflow-y-auto p-4">
          {groups.map((group) => (
            <CategorySection key={group.category} group={group} />
          ))}
        </div>

        {/* Footer */}
        <div className="border-t border-border bg-muted px-4 py-3">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <p>Shortcuts are disabled when typing in text fields</p>
            <p className="flex items-center gap-1">
              <KeyboardKey>Esc</KeyboardKey>
              <span>to close</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default KeyboardShortcutsModal
