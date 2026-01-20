"use client"

import { useEffect, useMemo, useRef } from "react"
import { HiOutlineXMark } from "react-icons/hi2"

import {
  CATEGORY_CONFIG,
  formatShortcutBinding,
  getModifierDisplay,
  getShortcutsByCategory,
  type ShortcutAction,
  type ShortcutCategory,
} from "@/app/lib/shortcuts"

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
      className="inline-flex min-w-[24px] items-center justify-center rounded border border-gray-300 bg-gray-100 px-2 py-1 text-xs font-medium text-gray-700 shadow-sm dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200"
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
  const formatted = formatShortcutBinding(action.defaultBinding)
  const parts = formatted.split("+")

  return (
    <div className="flex items-center gap-1">
      {parts.map((part, partIndex) => {
        // Use action.id + part as key since parts are derived from static config
        const uniqueKey = `${action.id}-part-${part}`
        return (
          <span key={uniqueKey} className="flex items-center gap-1">
            {partIndex > 0 && <span className="text-gray-400 dark:text-gray-500">+</span>}
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
        <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{action.name}</span>
        <span className="text-xs text-gray-500 dark:text-gray-400">{action.description}</span>
      </div>
      <ShortcutDisplay action={action} />
    </div>
  )
}

/**
 * Category section component
 */
function CategorySection({
  category,
  shortcuts,
}: {
  category: ShortcutCategory
  shortcuts: ShortcutAction[]
}) {
  const config = CATEGORY_CONFIG[category]

  if (shortcuts.length === 0) return null

  return (
    <div className="mb-6 last:mb-0">
      <div className="mb-3">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-700 dark:text-gray-300">
          {config.label}
        </h3>
        {config.description && (
          <p className="text-xs text-gray-500 dark:text-gray-400">{config.description}</p>
        )}
      </div>
      <div className="divide-y divide-gray-200 rounded-lg border border-gray-200 bg-white dark:divide-gray-700 dark:border-gray-700 dark:bg-gray-800">
        <div className="px-4">
          {shortcuts.map((shortcut) => (
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
  const modifierKey = useMemo(() => getModifierDisplay("meta"), [])

  // Get shortcuts grouped by category
  const shortcutsByCategory = useMemo(() => getShortcutsByCategory(), [])

  // Sort categories by order
  const sortedCategories = useMemo(() => {
    const categories: ShortcutCategory[] = ["navigation", "conversations", "messages", "general"]
    return categories
      .map((cat) => ({
        category: cat,
        shortcuts: shortcutsByCategory[cat] || [],
      }))
      .filter(({ shortcuts }) => shortcuts.length > 0)
      .sort((a, b) => {
        const orderA = CATEGORY_CONFIG[a.category]?.order || 99
        const orderB = CATEGORY_CONFIG[b.category]?.order || 99
        return orderA - orderB
      })
  }, [shortcutsByCategory])

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
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-neutral-800/70 pt-16 dark:bg-black/70"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="keyboard-shortcuts-title"
    >
      <div
        ref={modalRef}
        className="relative mx-4 mb-8 w-full max-w-xl rounded-lg bg-white shadow-xl dark:bg-gray-900"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 p-4 dark:border-gray-700">
          <div>
            <h2
              id="keyboard-shortcuts-title"
              className="text-lg font-semibold text-gray-900 dark:text-gray-100"
            >
              Keyboard Shortcuts
            </h2>
            <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
              Press <KeyboardKey>{modifierKey}</KeyboardKey>
              <span className="mx-1 text-gray-400">+</span>
              <KeyboardKey>/</KeyboardKey> or <KeyboardKey>?</KeyboardKey> to toggle this panel
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-2 text-gray-400 transition hover:bg-gray-100 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-sky-500 dark:hover:bg-gray-800 dark:hover:text-gray-300"
            aria-label="Close keyboard shortcuts panel"
          >
            <HiOutlineXMark size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="max-h-[60vh] overflow-y-auto p-4">
          {sortedCategories.map(({ category, shortcuts }) => (
            <CategorySection key={category} category={category} shortcuts={shortcuts} />
          ))}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 bg-gray-50 px-4 py-3 dark:border-gray-700 dark:bg-gray-800">
          <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
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
