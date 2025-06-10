"use client"

/**
 * Shortcut Configuration Library
 *
 * Defines all available keyboard shortcuts with default bindings,
 * provides utilities for parsing, formatting, and validating shortcuts,
 * and handles persistence via localStorage.
 */

// Storage key for custom shortcuts
export const SHORTCUTS_STORAGE_KEY = "infinstar-custom-shortcuts"
export const SHORTCUTS_ENABLED_KEY = "infinstar-shortcuts-enabled"

/**
 * Modifier keys supported by the system
 */
export type ModifierKey = "meta" | "ctrl" | "shift" | "alt"

/**
 * Shortcut binding definition
 */
export interface ShortcutBinding {
  key: string
  modifiers: ModifierKey[]
}

/**
 * Category for shortcut grouping
 */
export type ShortcutCategory = "navigation" | "conversations" | "messages" | "general"

/**
 * Shortcut action definition with metadata
 */
export interface ShortcutAction {
  id: string
  name: string
  description: string
  category: ShortcutCategory
  defaultBinding: ShortcutBinding
  /** Whether the shortcut should work when typing in an input */
  allowInInput?: boolean
  /** Whether the shortcut requires at least one modifier key */
  requiresModifier?: boolean
  /** Whether the shortcut is hidden from the help modal */
  hidden?: boolean
}

/**
 * Custom shortcuts stored in localStorage
 */
export type CustomShortcuts = Record<string, ShortcutBinding>

/**
 * All shortcut action IDs
 */
export type ShortcutActionId =
  | "globalSearch"
  | "newConversation"
  | "settings"
  | "toggleSidebar"
  | "showHelp"
  | "showHelpQuestion"
  | "closeModal"
  | "sendMessage"
  | "newLine"
  | "clearInput"
  | "nextConversation"
  | "prevConversation"
  | "archiveConversation"
  | "pinConversation"
  | "deleteConversation"
  | "toggleTheme"
  | "focusInput"
  | "scrollToBottom"
  | "openConversation"

/**
 * Default keyboard shortcuts configuration
 */
export const DEFAULT_SHORTCUTS: Record<ShortcutActionId, ShortcutAction> = {
  // Navigation shortcuts
  globalSearch: {
    id: "globalSearch",
    name: "Global Search",
    description: "Open the global search modal",
    category: "navigation",
    defaultBinding: { key: "k", modifiers: ["meta"] },
    requiresModifier: true,
  },
  showHelp: {
    id: "showHelp",
    name: "Keyboard Shortcuts",
    description: "Show this keyboard shortcuts panel",
    category: "navigation",
    defaultBinding: { key: "/", modifiers: ["meta"] },
    requiresModifier: true,
  },
  showHelpQuestion: {
    id: "showHelpQuestion",
    name: "Keyboard Shortcuts (Alt)",
    description: "Show keyboard shortcuts panel",
    category: "navigation",
    defaultBinding: { key: "?", modifiers: [] },
    requiresModifier: false,
    hidden: true,
  },
  closeModal: {
    id: "closeModal",
    name: "Close Modal",
    description: "Close any open modal or dialog",
    category: "navigation",
    defaultBinding: { key: "Escape", modifiers: [] },
    requiresModifier: false,
    hidden: true,
  },
  settings: {
    id: "settings",
    name: "Settings",
    description: "Open application settings",
    category: "general",
    defaultBinding: { key: ",", modifiers: ["meta"] },
    requiresModifier: true,
  },
  toggleSidebar: {
    id: "toggleSidebar",
    name: "Toggle Sidebar",
    description: "Show or hide the sidebar",
    category: "navigation",
    defaultBinding: { key: "b", modifiers: ["meta"] },
    requiresModifier: true,
  },
  toggleTheme: {
    id: "toggleTheme",
    name: "Toggle Theme",
    description: "Switch between light and dark mode",
    category: "general",
    defaultBinding: { key: "d", modifiers: ["meta", "shift"] },
    requiresModifier: true,
  },

  // Conversation shortcuts
  newConversation: {
    id: "newConversation",
    name: "New Conversation",
    description: "Start a new AI conversation",
    category: "conversations",
    defaultBinding: { key: "n", modifiers: ["meta"] },
    requiresModifier: true,
  },
  nextConversation: {
    id: "nextConversation",
    name: "Next Conversation",
    description: "Navigate to the next conversation",
    category: "conversations",
    defaultBinding: { key: "ArrowDown", modifiers: ["meta"] },
    requiresModifier: true,
  },
  prevConversation: {
    id: "prevConversation",
    name: "Previous Conversation",
    description: "Navigate to the previous conversation",
    category: "conversations",
    defaultBinding: { key: "ArrowUp", modifiers: ["meta"] },
    requiresModifier: true,
  },
  openConversation: {
    id: "openConversation",
    name: "Open Conversation",
    description: "Open the selected conversation",
    category: "conversations",
    defaultBinding: { key: "Enter", modifiers: [] },
    requiresModifier: false,
    hidden: true,
  },
  archiveConversation: {
    id: "archiveConversation",
    name: "Archive Conversation",
    description: "Archive the current conversation",
    category: "conversations",
    defaultBinding: { key: "e", modifiers: ["meta"] },
    requiresModifier: true,
  },
  pinConversation: {
    id: "pinConversation",
    name: "Pin Conversation",
    description: "Pin the current conversation",
    category: "conversations",
    defaultBinding: { key: "p", modifiers: ["meta", "shift"] },
    requiresModifier: true,
  },
  deleteConversation: {
    id: "deleteConversation",
    name: "Delete Conversation",
    description: "Delete the current conversation",
    category: "conversations",
    defaultBinding: { key: "Backspace", modifiers: ["meta", "shift"] },
    requiresModifier: true,
  },

  // Message shortcuts
  sendMessage: {
    id: "sendMessage",
    name: "Send Message",
    description: "Send the current message",
    category: "messages",
    defaultBinding: { key: "Enter", modifiers: ["meta"] },
    allowInInput: true,
    requiresModifier: true,
  },
  newLine: {
    id: "newLine",
    name: "New Line",
    description: "Insert a new line in the message",
    category: "messages",
    defaultBinding: { key: "Enter", modifiers: ["shift"] },
    allowInInput: true,
    requiresModifier: true,
  },
  clearInput: {
    id: "clearInput",
    name: "Clear Input",
    description: "Clear the message input",
    category: "messages",
    defaultBinding: { key: "Escape", modifiers: [] },
    allowInInput: true,
    requiresModifier: false,
  },
  focusInput: {
    id: "focusInput",
    name: "Focus Input",
    description: "Focus the message input field",
    category: "messages",
    defaultBinding: { key: "i", modifiers: ["meta"] },
    requiresModifier: true,
  },
  scrollToBottom: {
    id: "scrollToBottom",
    name: "Scroll to Bottom",
    description: "Scroll to the latest message",
    category: "messages",
    defaultBinding: { key: "End", modifiers: ["meta"] },
    requiresModifier: true,
  },
}

/**
 * Category display configuration
 */
export const CATEGORY_CONFIG: Record<
  ShortcutCategory,
  { label: string; description: string; order: number }
> = {
  navigation: {
    label: "Navigation",
    description: "Move around the application",
    order: 1,
  },
  conversations: {
    label: "Conversations",
    description: "Manage your conversations",
    order: 2,
  },
  messages: {
    label: "Messages",
    description: "Send and manage messages",
    order: 3,
  },
  general: {
    label: "General",
    description: "Application-wide shortcuts",
    order: 4,
  },
}

/**
 * Platform detection
 */
export function isMac(): boolean {
  if (typeof window === "undefined") return false
  return navigator.platform.toUpperCase().indexOf("MAC") >= 0
}

/**
 * Get display name for a modifier key based on platform
 */
export function getModifierDisplay(modifier: ModifierKey): string {
  const isMacPlatform = isMac()

  switch (modifier) {
    case "meta":
      return isMacPlatform ? "Cmd" : "Ctrl"
    case "ctrl":
      return "Ctrl"
    case "shift":
      return "Shift"
    case "alt":
      return isMacPlatform ? "Option" : "Alt"
    default:
      return modifier
  }
}

/**
 * Get symbol for a modifier key based on platform
 */
export function getModifierSymbol(modifier: ModifierKey): string {
  const isMacPlatform = isMac()

  switch (modifier) {
    case "meta":
      return isMacPlatform ? "\u2318" : "Ctrl"
    case "ctrl":
      return isMacPlatform ? "\u2303" : "Ctrl"
    case "shift":
      return isMacPlatform ? "\u21E7" : "Shift"
    case "alt":
      return isMacPlatform ? "\u2325" : "Alt"
    default:
      return modifier
  }
}

/**
 * Format a key for display
 */
export function formatKeyDisplay(key: string): string {
  const keyMap: Record<string, string> = {
    arrowup: "\u2191",
    arrowdown: "\u2193",
    arrowleft: "\u2190",
    arrowright: "\u2192",
    enter: "Enter",
    escape: "Esc",
    backspace: "\u232B",
    delete: "Del",
    tab: "Tab",
    space: "Space",
    end: "End",
    home: "Home",
    pageup: "PgUp",
    pagedown: "PgDn",
  }

  const lowerKey = key.toLowerCase()
  return keyMap[lowerKey] || key.toUpperCase()
}

/**
 * Format a shortcut binding for display
 */
export function formatShortcutBinding(binding: ShortcutBinding): string {
  const parts: string[] = []

  // Add modifiers in consistent order
  const modifierOrder: ModifierKey[] = ["meta", "ctrl", "shift", "alt"]
  for (const modifier of modifierOrder) {
    if (binding.modifiers.includes(modifier)) {
      parts.push(getModifierDisplay(modifier))
    }
  }

  parts.push(formatKeyDisplay(binding.key))

  return parts.join("+")
}

/**
 * Format a shortcut binding with symbols
 */
export function formatShortcutWithSymbols(binding: ShortcutBinding): string {
  const parts: string[] = []

  const modifierOrder: ModifierKey[] = ["meta", "ctrl", "shift", "alt"]
  for (const modifier of modifierOrder) {
    if (binding.modifiers.includes(modifier)) {
      parts.push(getModifierSymbol(modifier))
    }
  }

  parts.push(formatKeyDisplay(binding.key))

  return parts.join("")
}

/**
 * Parse a keyboard event into a ShortcutBinding
 */
export function parseKeyboardEvent(event: KeyboardEvent): ShortcutBinding {
  const modifiers: ModifierKey[] = []

  if (event.metaKey) modifiers.push("meta")
  if (event.ctrlKey && !event.metaKey) modifiers.push("ctrl")
  if (event.shiftKey) modifiers.push("shift")
  if (event.altKey) modifiers.push("alt")

  return {
    key: event.key,
    modifiers,
  }
}

/**
 * Check if the meta key (Cmd on Mac, Ctrl on Windows/Linux) is pressed
 */
export function isMetaPressed(event: KeyboardEvent): boolean {
  return isMac() ? event.metaKey : event.ctrlKey
}

/**
 * Check if two shortcut bindings are equal
 */
export function bindingsEqual(a: ShortcutBinding, b: ShortcutBinding): boolean {
  if (a.key.toLowerCase() !== b.key.toLowerCase()) return false
  if (a.modifiers.length !== b.modifiers.length) return false

  const sortedA = [...a.modifiers].sort()
  const sortedB = [...b.modifiers].sort()

  return sortedA.every((mod, index) => mod === sortedB[index])
}

/**
 * Validate a shortcut binding
 */
export interface ValidationResult {
  valid: boolean
  error?: string
}

export function validateBinding(actionId: string, binding: ShortcutBinding): ValidationResult {
  const action = DEFAULT_SHORTCUTS[actionId as ShortcutActionId]

  if (!action) {
    return { valid: false, error: "Unknown action" }
  }

  // Check if modifier is required but not provided
  if (action.requiresModifier && binding.modifiers.length === 0) {
    return {
      valid: false,
      error: "This shortcut requires at least one modifier key (Cmd/Ctrl, Shift, or Alt)",
    }
  }

  // Disallow certain key combinations
  const disallowedKeys = ["F1", "F2", "F3", "F4", "F5", "F6", "F7", "F8", "F9", "F10", "F11", "F12"]
  if (disallowedKeys.includes(binding.key)) {
    return {
      valid: false,
      error: "Function keys are reserved and cannot be used",
    }
  }

  // Disallow single letter/number keys without modifiers
  if (
    binding.modifiers.length === 0 &&
    binding.key.length === 1 &&
    /^[a-zA-Z0-9]$/.test(binding.key)
  ) {
    return {
      valid: false,
      error: "Single character shortcuts require a modifier key",
    }
  }

  return { valid: true }
}

/**
 * Find conflicts between a binding and existing shortcuts
 */
export interface ShortcutConflict {
  actionId: string
  actionName: string
}

export function findConflicts(
  actionId: string,
  binding: ShortcutBinding,
  customShortcuts: CustomShortcuts
): ShortcutConflict[] {
  const conflicts: ShortcutConflict[] = []

  for (const [id, action] of Object.entries(DEFAULT_SHORTCUTS)) {
    if (id === actionId) continue

    const existingBinding = customShortcuts[id] || action.defaultBinding

    if (bindingsEqual(binding, existingBinding)) {
      conflicts.push({
        actionId: id,
        actionName: action.name,
      })
    }
  }

  return conflicts
}

/**
 * Load custom shortcuts from localStorage
 */
export function loadCustomShortcuts(): CustomShortcuts {
  if (typeof window === "undefined") return {}

  try {
    const stored = localStorage.getItem(SHORTCUTS_STORAGE_KEY)
    if (!stored) return {}

    const parsed = JSON.parse(stored) as CustomShortcuts

    // Validate the parsed data
    if (typeof parsed !== "object" || parsed === null) {
      return {}
    }

    // Filter out invalid entries
    const valid: CustomShortcuts = {}
    for (const [actionId, binding] of Object.entries(parsed)) {
      if (
        DEFAULT_SHORTCUTS[actionId as ShortcutActionId] &&
        typeof binding === "object" &&
        typeof binding.key === "string" &&
        Array.isArray(binding.modifiers)
      ) {
        valid[actionId] = binding
      }
    }

    return valid
  } catch {
    return {}
  }
}

/**
 * Save custom shortcuts to localStorage
 */
export function saveCustomShortcuts(shortcuts: CustomShortcuts): void {
  if (typeof window === "undefined") return

  try {
    localStorage.setItem(SHORTCUTS_STORAGE_KEY, JSON.stringify(shortcuts))
  } catch (error) {
    console.error("Failed to save custom shortcuts:", error)
  }
}

/**
 * Get the effective binding for an action (custom or default)
 */
export function getEffectiveBinding(
  actionId: ShortcutActionId,
  customShortcuts: CustomShortcuts
): ShortcutBinding {
  if (customShortcuts[actionId]) {
    return customShortcuts[actionId]
  }

  const action = DEFAULT_SHORTCUTS[actionId]
  return action?.defaultBinding || { key: "", modifiers: [] }
}

/**
 * Check if a binding differs from the default
 */
export function isCustomized(actionId: string, customShortcuts: CustomShortcuts): boolean {
  const custom = customShortcuts[actionId]
  if (!custom) return false

  const action = DEFAULT_SHORTCUTS[actionId as ShortcutActionId]
  if (!action) return false

  return !bindingsEqual(custom, action.defaultBinding)
}

/**
 * Reset a single shortcut to default
 */
export function resetShortcut(actionId: string, customShortcuts: CustomShortcuts): CustomShortcuts {
  const { [actionId]: _, ...rest } = customShortcuts
  return rest
}

/**
 * Reset all shortcuts to defaults
 */
export function resetAllShortcuts(): CustomShortcuts {
  return {}
}

/**
 * Load shortcuts enabled state from localStorage
 */
export function loadShortcutsEnabled(): boolean {
  if (typeof window === "undefined") return true

  try {
    const stored = localStorage.getItem(SHORTCUTS_ENABLED_KEY)
    return stored !== "false"
  } catch {
    return true
  }
}

/**
 * Save shortcuts enabled state to localStorage
 */
export function saveShortcutsEnabled(enabled: boolean): void {
  if (typeof window === "undefined") return

  try {
    localStorage.setItem(SHORTCUTS_ENABLED_KEY, String(enabled))
  } catch (error) {
    console.error("Failed to save shortcuts enabled state:", error)
  }
}

/**
 * Export shortcuts configuration as JSON
 */
export function exportShortcuts(customShortcuts: CustomShortcuts): string {
  const exportData = {
    version: 1,
    shortcuts: customShortcuts,
    exportedAt: new Date().toISOString(),
  }
  return JSON.stringify(exportData, null, 2)
}

/**
 * Import shortcuts configuration from JSON
 */
export interface ImportResult {
  success: boolean
  shortcuts?: CustomShortcuts
  error?: string
}

export function importShortcuts(jsonString: string): ImportResult {
  try {
    const data = JSON.parse(jsonString)

    if (typeof data !== "object" || data === null) {
      return { success: false, error: "Invalid import format" }
    }

    // Handle both direct shortcuts object and wrapped format
    const shortcuts = data.shortcuts || data

    if (typeof shortcuts !== "object" || shortcuts === null) {
      return { success: false, error: "Invalid shortcuts data" }
    }

    // Validate and filter shortcuts
    const valid: CustomShortcuts = {}
    for (const [actionId, binding] of Object.entries(shortcuts)) {
      if (!DEFAULT_SHORTCUTS[actionId as ShortcutActionId]) continue

      const b = binding as ShortcutBinding
      if (typeof b === "object" && typeof b.key === "string" && Array.isArray(b.modifiers)) {
        const validation = validateBinding(actionId, b)
        if (validation.valid) {
          valid[actionId] = b
        }
      }
    }

    return { success: true, shortcuts: valid }
  } catch {
    return { success: false, error: "Invalid JSON format" }
  }
}

/**
 * Get all shortcuts grouped by category (excluding hidden shortcuts)
 */
export function getShortcutsByCategory(): Record<ShortcutCategory, ShortcutAction[]> {
  const categories: Record<ShortcutCategory, ShortcutAction[]> = {
    navigation: [],
    conversations: [],
    messages: [],
    general: [],
  }

  for (const action of Object.values(DEFAULT_SHORTCUTS)) {
    if (!action.hidden) {
      categories[action.category].push(action)
    }
  }

  return categories
}

/**
 * Get all visible shortcuts for display
 */
export function getVisibleShortcuts(): ShortcutAction[] {
  return Object.values(DEFAULT_SHORTCUTS).filter((action) => !action.hidden)
}

/**
 * Get all actions including hidden ones
 */
export function getAllActions(): ShortcutAction[] {
  return Object.values(DEFAULT_SHORTCUTS)
}

/**
 * Check if the user is currently typing in an input element
 */
export function isTypingInInput(): boolean {
  if (typeof document === "undefined") return false

  const activeElement = document.activeElement
  if (!activeElement) return false

  const tagName = activeElement.tagName.toLowerCase()
  const isInput = tagName === "input" || tagName === "textarea"
  const isContentEditable = activeElement.getAttribute("contenteditable") === "true"

  return isInput || isContentEditable
}

/**
 * Check if a keyboard event matches a shortcut binding
 */
export function eventMatchesBinding(event: KeyboardEvent, binding: ShortcutBinding): boolean {
  // Check key (case-insensitive)
  const keyMatches = event.key.toLowerCase() === binding.key.toLowerCase()
  if (!keyMatches) return false

  // Check meta/ctrl modifier
  const needsMeta = binding.modifiers.includes("meta")
  const needsCtrl = binding.modifiers.includes("ctrl")
  const metaPressed = isMetaPressed(event)

  if (needsMeta && !metaPressed) return false
  if (!needsMeta && !needsCtrl && metaPressed) return false

  // Check shift modifier
  const needsShift = binding.modifiers.includes("shift")
  if (needsShift !== event.shiftKey) return false

  // Check alt modifier
  const needsAlt = binding.modifiers.includes("alt")
  if (needsAlt !== event.altKey) return false

  return true
}
