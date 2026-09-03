"use client"

import { useCallback, useEffect, useMemo, useState } from "react"

import {
  shortcuts as registry,
  type ShortcutAction,
  type ShortcutActionId,
  type ShortcutBinding,
  type ShortcutCategory,
} from "@/app/lib/shortcuts"

/**
 * Whether the current platform is a Mac. Kept here because message and voice
 * inputs render platform-specific hints without touching the registry.
 */
export function isMac(): boolean {
  return registry.platform().isMac
}

/**
 * Registered shortcut handler
 */
export interface ShortcutHandler {
  /** Unique identifier for the shortcut */
  id: ShortcutActionId
  /** The callback to execute when the shortcut is triggered */
  action: () => void
  /** Override whether the shortcut should work when typing in an input */
  allowInInput?: boolean
  /** Override the enabled state for this specific shortcut */
  enabled?: boolean
}

/**
 * Options for the useKeyboardShortcuts hook
 */
export interface UseKeyboardShortcutsOptions {
  /** Array of shortcut handlers to register */
  handlers: ShortcutHandler[]
  /** Whether keyboard shortcuts are globally enabled (default: true) */
  enabled?: boolean
}

/**
 * Return type for the useKeyboardShortcuts hook
 */
export interface UseKeyboardShortcutsReturn {
  /** Whether shortcuts are globally enabled */
  enabled: boolean
  /** Toggle the global enabled state */
  setEnabled: (enabled: boolean) => void
  /** Get the effective binding for an action */
  getBinding: (actionId: ShortcutActionId) => ShortcutBinding
  /** Format a binding for display */
  formatBinding: (actionId: ShortcutActionId) => string
  /** All visible shortcut definitions */
  shortcuts: ShortcutAction[]
  /** Shortcuts grouped by category */
  byCategory: Record<ShortcutCategory, ShortcutAction[]>
  /** Platform modifier key display (Cmd or Ctrl) */
  modifierKey: string
  /** Platform modifier symbol */
  modifierSymbol: string
  /** Whether the current platform is Mac */
  isMacPlatform: boolean
}

/**
 * useKeyboardShortcuts Hook
 *
 * Centralizes keyboard shortcut handling for the application.
 * Handles platform-specific modifier keys (Cmd vs Ctrl) and
 * prevents shortcuts from firing when typing in inputs (unless explicitly allowed).
 *
 * @example
 * ```tsx
 * const { shortcuts, formatBinding } = useKeyboardShortcuts({
 *   handlers: [
 *     {
 *       id: 'globalSearch',
 *       action: () => openSearch()
 *     },
 *     {
 *       id: 'newConversation',
 *       action: () => createConversation()
 *     }
 *   ]
 * })
 * ```
 */
export function useKeyboardShortcuts({
  handlers,
  enabled: enabledProp = true,
}: UseKeyboardShortcutsOptions): UseKeyboardShortcutsReturn {
  // Load initial enabled state from localStorage
  const [enabled, setEnabledState] = useState(() => {
    if (typeof window === "undefined") return enabledProp
    return registry.isEnabled() && enabledProp
  })

  // Update enabled state when prop changes
  useEffect(() => {
    setEnabledState(registry.isEnabled() && enabledProp)
  }, [enabledProp])

  // Set enabled state and persist to localStorage
  const setEnabled = useCallback((newEnabled: boolean) => {
    setEnabledState(newEnabled)
    registry.setEnabled(newEnabled)
  }, [])

  // Get binding for an action
  const getBinding = useCallback(
    (actionId: ShortcutActionId): ShortcutBinding => registry.binding(actionId),
    []
  )

  // Format binding for display
  const formatBinding = useCallback(
    (actionId: ShortcutActionId): string => registry.display(actionId),
    []
  )

  // Handle keydown events
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!enabled) return

      // The registry decides which action a key event belongs to; handlers are
      // offered in registration order and carry their own overrides.
      const actionId = registry.resolve(event, { among: handlers })
      if (!actionId) return

      const handler = handlers.find((h) => h.id === actionId && h.enabled !== false)
      if (!handler) return

      event.preventDefault()
      event.stopPropagation()
      handler.action()
    },
    [enabled, handlers]
  )

  // Register keyboard event listener
  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [handleKeyDown])

  // Memoized values
  const groups = useMemo(() => registry.groups(), [])
  const shortcuts = useMemo(() => registry.list(), [])
  const byCategory = useMemo(
    () =>
      groups.reduce(
        (acc, group) => {
          acc[group.category] = group.shortcuts
          return acc
        },
        {} as Record<ShortcutCategory, ShortcutAction[]>
      ),
    [groups]
  )
  const platform = useMemo(() => registry.platform(), [])
  const modifierKey = platform.modifierKey
  const modifierSymbol = platform.modifierSymbol
  const isMacPlatform = platform.isMac

  return {
    enabled,
    setEnabled,
    getBinding,
    formatBinding,
    shortcuts,
    byCategory,
    modifierKey,
    modifierSymbol,
    isMacPlatform,
  }
}

/**
 * Legacy types for backward compatibility
 */
export interface KeyboardShortcut {
  id: string
  name: string
  description: string
  category: "navigation" | "conversations" | "messages" | "general"
  key: string
  modifierKey?: boolean
  shiftKey?: boolean
  altKey?: boolean
  action: () => void
  allowInInput?: boolean
  enabled?: boolean
}

/**
 * Legacy options interface for backward compatibility
 */
interface LegacyUseKeyboardShortcutsOptions {
  shortcuts: KeyboardShortcut[]
  enabled?: boolean
}

/**
 * Get display string for the modifier key based on platform
 * @deprecated Use shortcuts.platform() instead
 */
export function getModifierKeyDisplay(): string {
  return registry.platform().modifierKey
}

/**
 * Get symbol for the modifier key based on platform
 * @deprecated Use shortcuts.platform() instead
 */
export function getModifierKeySymbol(): string {
  return registry.platform().modifierSymbol
}

/**
 * Format a legacy shortcut for display
 */
export function formatShortcut(shortcut: KeyboardShortcut): string {
  const parts: string[] = []

  if (shortcut.modifierKey) {
    parts.push(registry.platform().modifierKey)
  }
  if (shortcut.shiftKey) {
    parts.push("Shift")
  }
  if (shortcut.altKey) {
    parts.push(registry.platform().isMac ? "Option" : "Alt")
  }

  // Format the key for display
  let keyDisplay = shortcut.key.toUpperCase()
  if (shortcut.key.toLowerCase() === "arrowup") keyDisplay = "\u2191"
  else if (shortcut.key.toLowerCase() === "arrowdown") keyDisplay = "\u2193"
  else if (shortcut.key.toLowerCase() === "arrowleft") keyDisplay = "\u2190"
  else if (shortcut.key.toLowerCase() === "arrowright") keyDisplay = "\u2192"
  else if (shortcut.key.toLowerCase() === "enter") keyDisplay = "Enter"
  else if (shortcut.key.toLowerCase() === "escape") keyDisplay = "Esc"

  parts.push(keyDisplay)

  return parts.join("+")
}

/**
 * Get shortcuts grouped by category (legacy format)
 */
export function getShortcutsByCategory(
  shortcuts: KeyboardShortcut[]
): Record<string, KeyboardShortcut[]> {
  return shortcuts.reduce(
    (acc, shortcut) => {
      const category = shortcut.category
      if (!acc[category]) {
        acc[category] = []
      }
      acc[category].push(shortcut)
      return acc
    },
    {} as Record<string, KeyboardShortcut[]>
  )
}

/**
 * Hook to get formatted shortcuts for the current platform (legacy)
 */
export function useFormattedShortcuts(shortcuts: KeyboardShortcut[]): {
  shortcuts: KeyboardShortcut[]
  byCategory: Record<string, KeyboardShortcut[]>
  formatShortcut: (shortcut: KeyboardShortcut) => string
  modifierKey: string
  modifierSymbol: string
} {
  const platform = useMemo(() => registry.platform(), [])
  const modifierKey = platform.modifierKey
  const modifierSymbol = platform.modifierSymbol
  const byCategory = useMemo(() => getShortcutsByCategory(shortcuts), [shortcuts])

  return {
    shortcuts,
    byCategory,
    formatShortcut,
    modifierKey,
    modifierSymbol,
  }
}

/**
 * Legacy useKeyboardShortcuts hook for backward compatibility
 * Supports the old format with KeyboardShortcut[] array
 *
 * @example
 * ```tsx
 * useLegacyKeyboardShortcuts({
 *   shortcuts: [
 *     {
 *       id: 'toggle-voice-input',
 *       name: 'Toggle Voice Input',
 *       description: 'Start or stop voice input',
 *       category: 'messages',
 *       key: 'v',
 *       modifierKey: true,
 *       shiftKey: true,
 *       allowInInput: true,
 *       action: () => toggleVoiceInput()
 *     }
 *   ]
 * })
 * ```
 */
export function useLegacyKeyboardShortcuts({
  shortcuts,
  enabled = true,
}: LegacyUseKeyboardShortcutsOptions): void {
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!enabled) return

      for (const shortcut of shortcuts) {
        // Skip disabled shortcuts
        if (shortcut.enabled === false) continue

        // These shortcuts are component-local and not registry actions, so
        // match them as a binding rather than resolving an action id.
        const binding: ShortcutBinding = {
          key: shortcut.key,
          modifiers: [
            ...(shortcut.modifierKey ? (["meta"] as const) : []),
            ...(shortcut.shiftKey ? (["shift"] as const) : []),
            ...(shortcut.altKey ? (["alt"] as const) : []),
          ],
        }

        if (!registry.matches(event, binding, { allowInInput: shortcut.allowInInput })) continue

        // All conditions met - execute the action
        event.preventDefault()
        event.stopPropagation()
        shortcut.action()
        return
      }
    },
    [shortcuts, enabled]
  )

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [handleKeyDown])
}

export default useKeyboardShortcuts
