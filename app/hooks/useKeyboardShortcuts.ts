"use client"

import { useCallback, useEffect, useMemo, useState } from "react"

import {
  DEFAULT_SHORTCUTS,
  eventMatchesBinding,
  formatShortcutBinding,
  getEffectiveBinding,
  getModifierDisplay,
  getModifierSymbol,
  getShortcutsByCategory as getShortcutsByCategoryFromConfig,
  getVisibleShortcuts,
  isMac,
  isMetaPressed,
  isTypingInInput,
  loadCustomShortcuts,
  loadShortcutsEnabled,
  saveShortcutsEnabled,
  type CustomShortcuts,
  type ShortcutAction,
  type ShortcutActionId,
  type ShortcutBinding,
  type ShortcutCategory,
} from "@/app/lib/shortcuts"

// Re-export isMac for backward compatibility
export { isMac } from "@/app/lib/shortcuts"

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
    return loadShortcutsEnabled() && enabledProp
  })

  // Load custom shortcuts
  const [customShortcuts] = useState<CustomShortcuts>(() => loadCustomShortcuts())

  // Update enabled state when prop changes
  useEffect(() => {
    setEnabledState(loadShortcutsEnabled() && enabledProp)
  }, [enabledProp])

  // Set enabled state and persist to localStorage
  const setEnabled = useCallback((newEnabled: boolean) => {
    setEnabledState(newEnabled)
    saveShortcutsEnabled(newEnabled)
  }, [])

  // Get binding for an action
  const getBinding = useCallback(
    (actionId: ShortcutActionId): ShortcutBinding => {
      return getEffectiveBinding(actionId, customShortcuts)
    },
    [customShortcuts]
  )

  // Format binding for display
  const formatBinding = useCallback(
    (actionId: ShortcutActionId): string => {
      const binding = getBinding(actionId)
      return formatShortcutBinding(binding)
    },
    [getBinding]
  )

  // Handle keydown events
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!enabled) return

      const isTyping = isTypingInInput()

      for (const handler of handlers) {
        // Skip disabled handlers
        if (handler.enabled === false) continue

        // Get the action definition
        const action = DEFAULT_SHORTCUTS[handler.id]
        if (!action) continue

        // Check if we should allow this shortcut in input
        const allowInInput = handler.allowInInput ?? action.allowInInput ?? false
        if (isTyping && !allowInInput) continue

        // Get the effective binding (custom or default)
        const binding = getEffectiveBinding(handler.id, customShortcuts)

        // Check if the event matches the binding
        if (eventMatchesBinding(event, binding)) {
          event.preventDefault()
          event.stopPropagation()
          handler.action()
          return
        }
      }
    },
    [enabled, handlers, customShortcuts]
  )

  // Register keyboard event listener
  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [handleKeyDown])

  // Memoized values
  const shortcuts = useMemo(() => getVisibleShortcuts(), [])
  const byCategory = useMemo(() => getShortcutsByCategoryFromConfig(), [])
  const modifierKey = useMemo(() => getModifierDisplay("meta"), [])
  const modifierSymbol = useMemo(() => getModifierSymbol("meta"), [])
  const isMacPlatform = useMemo(() => isMac(), [])

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
 * @deprecated Use getModifierDisplay from shortcuts.ts instead
 */
export function getModifierKeyDisplay(): string {
  return getModifierDisplay("meta")
}

/**
 * Get symbol for the modifier key based on platform
 * @deprecated Use getModifierSymbol from shortcuts.ts instead
 */
export function getModifierKeySymbol(): string {
  return getModifierSymbol("meta")
}

/**
 * Format a legacy shortcut for display
 */
export function formatShortcut(shortcut: KeyboardShortcut): string {
  const parts: string[] = []

  if (shortcut.modifierKey) {
    parts.push(getModifierDisplay("meta"))
  }
  if (shortcut.shiftKey) {
    parts.push("Shift")
  }
  if (shortcut.altKey) {
    parts.push(isMac() ? "Option" : "Alt")
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
  return shortcuts.reduce((acc, shortcut) => {
    const category = shortcut.category
    if (!acc[category]) {
      acc[category] = []
    }
    acc[category].push(shortcut)
    return acc
  }, {} as Record<string, KeyboardShortcut[]>)
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
  const modifierKey = useMemo(() => getModifierDisplay("meta"), [])
  const modifierSymbol = useMemo(() => getModifierSymbol("meta"), [])
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

      const isTyping = isTypingInInput()

      for (const shortcut of shortcuts) {
        // Skip disabled shortcuts
        if (shortcut.enabled === false) continue

        // Skip if typing in input and shortcut doesn't allow it
        if (isTyping && !shortcut.allowInInput) continue

        // Check if the key matches
        const keyMatches = event.key.toLowerCase() === shortcut.key.toLowerCase()
        if (!keyMatches) continue

        // Check modifier key requirements
        const modifierPressed = isMetaPressed(event)
        const modifierMatches = shortcut.modifierKey ? modifierPressed : !modifierPressed
        if (!modifierMatches) continue

        // Check shift key requirement
        const shiftMatches = shortcut.shiftKey ? event.shiftKey : !event.shiftKey
        if (!shiftMatches) continue

        // Check alt key requirement
        const altMatches = shortcut.altKey ? event.altKey : !event.altKey
        if (!altMatches) continue

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
