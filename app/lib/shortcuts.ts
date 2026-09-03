"use client"

/**
 * Keyboard shortcut registry.
 *
 * One module, one exported value: `shortcuts`. It owns the catalogue of
 * actions, the user's customised bindings, their persistence in
 * localStorage, key resolution for a KeyboardEvent, and display formatting.
 *
 * Callers never see bindings storage, platform detection, modifier parsing or
 * conflict scanning — those are implementation.
 */

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/**
 * A key plus the modifiers that must be held with it.
 */
export interface ShortcutBinding {
  key: string
  modifiers: ModifierKey[]
}

/**
 * Category a shortcut is grouped under for display.
 */
export type ShortcutCategory = "navigation" | "conversations" | "messages" | "general"

/**
 * A shortcut action and its metadata.
 */
export interface ShortcutAction {
  id: ShortcutActionId
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
 * Every action the registry knows about.
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
 * A display group: one category, its labels, and the visible shortcuts in it.
 */
export interface ShortcutGroup {
  category: ShortcutCategory
  label: string
  description: string
  shortcuts: ShortcutAction[]
}

/**
 * Outcome of `shortcuts.rebind`. A rebind is refused when the binding is
 * invalid, or when it collides with another action's effective binding and
 * `force` was not passed.
 */
export interface RebindResult {
  ok: boolean
  /** Why an invalid binding was refused */
  error?: string
  /** Actions already using this binding (populated whether or not it applied) */
  conflicts?: Array<{ actionId: ShortcutActionId; actionName: string }>
}

/**
 * Outcome of `shortcuts.importConfig`. Unknown action ids and bindings that
 * fail validation are dropped rather than failing the whole import.
 */
export interface ImportResult {
  ok: boolean
  /** Why the payload could not be read at all */
  error?: string
  /** How many bindings survived validation and were applied */
  applied?: number
}

// ---------------------------------------------------------------------------
// Implementation: catalogue and display data
// ---------------------------------------------------------------------------

const SHORTCUTS_STORAGE_KEY = "infinstar-custom-shortcuts"
const SHORTCUTS_ENABLED_KEY = "infinstar-shortcuts-enabled"

type ModifierKey = "meta" | "ctrl" | "shift" | "alt"

type CustomShortcuts = Partial<Record<ShortcutActionId, ShortcutBinding>>

const DEFAULT_SHORTCUTS: Record<ShortcutActionId, ShortcutAction> = {
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

const CATEGORY_CONFIG: Record<
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
 * Own-property check: a plain `DEFAULT_SHORTCUTS[id]` lookup answers truthily
 * for inherited keys such as `__proto__`, which untrusted JSON can carry.
 */
function isKnownAction(actionId: string): actionId is ShortcutActionId {
  return Object.prototype.hasOwnProperty.call(DEFAULT_SHORTCUTS, actionId)
}

// ---------------------------------------------------------------------------
// Implementation: platform + display
// ---------------------------------------------------------------------------

function isMac(): boolean {
  if (typeof window === "undefined") return false
  return navigator.platform.toUpperCase().indexOf("MAC") >= 0
}

function getModifierDisplay(modifier: ModifierKey): string {
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

function getModifierSymbol(modifier: ModifierKey): string {
  const isMacPlatform = isMac()

  switch (modifier) {
    case "meta":
      return isMacPlatform ? "⌘" : "Ctrl"
    case "ctrl":
      return isMacPlatform ? "⌃" : "Ctrl"
    case "shift":
      return isMacPlatform ? "⇧" : "Shift"
    case "alt":
      return isMacPlatform ? "⌥" : "Alt"
    default:
      return modifier
  }
}

function formatKeyDisplay(key: string): string {
  const keyMap: Record<string, string> = {
    arrowup: "↑",
    arrowdown: "↓",
    arrowleft: "←",
    arrowright: "→",
    enter: "Enter",
    escape: "Esc",
    backspace: "⌫",
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

const MODIFIER_ORDER: ModifierKey[] = ["meta", "ctrl", "shift", "alt"]

function formatShortcutBinding(binding: ShortcutBinding): string {
  const parts: string[] = []

  for (const modifier of MODIFIER_ORDER) {
    if (binding.modifiers.includes(modifier)) {
      parts.push(getModifierDisplay(modifier))
    }
  }

  parts.push(formatKeyDisplay(binding.key))

  return parts.join("+")
}

function formatShortcutWithSymbols(binding: ShortcutBinding): string {
  const parts: string[] = []

  for (const modifier of MODIFIER_ORDER) {
    if (binding.modifiers.includes(modifier)) {
      parts.push(getModifierSymbol(modifier))
    }
  }

  parts.push(formatKeyDisplay(binding.key))

  return parts.join("")
}

// ---------------------------------------------------------------------------
// Implementation: matching
// ---------------------------------------------------------------------------

function isMetaPressed(event: KeyboardEvent): boolean {
  return isMac() ? event.metaKey : event.ctrlKey
}

function bindingsEqual(a: ShortcutBinding, b: ShortcutBinding): boolean {
  if (a.key.toLowerCase() !== b.key.toLowerCase()) return false
  if (a.modifiers.length !== b.modifiers.length) return false

  const sortedA = [...a.modifiers].sort()
  const sortedB = [...b.modifiers].sort()

  return sortedA.every((mod, index) => mod === sortedB[index])
}

function eventMatchesBinding(event: KeyboardEvent, binding: ShortcutBinding): boolean {
  // Check key (case-insensitive)
  const keyMatches = event.key.toLowerCase() === binding.key.toLowerCase()
  if (!keyMatches) return false

  // Check meta/ctrl modifier
  const needsMeta = binding.modifiers.includes("meta")
  const needsCtrl = binding.modifiers.includes("ctrl")
  const metaPressed = isMetaPressed(event)

  if (needsMeta && !metaPressed) return false
  // A binding that explicitly names ctrl must actually see ctrl held; without
  // this a ctrl-bound action fired on the bare key.
  if (needsCtrl && !event.ctrlKey) return false
  if (!needsMeta && !needsCtrl && metaPressed) return false

  // Check shift modifier
  const needsShift = binding.modifiers.includes("shift")
  if (needsShift !== event.shiftKey) return false

  // Check alt modifier
  const needsAlt = binding.modifiers.includes("alt")
  if (needsAlt !== event.altKey) return false

  return true
}

function isTypingInInput(): boolean {
  if (typeof document === "undefined") return false

  const activeElement = document.activeElement
  if (!activeElement) return false

  const tagName = activeElement.tagName.toLowerCase()
  const isInput = tagName === "input" || tagName === "textarea"
  const isContentEditable = activeElement.getAttribute("contenteditable") === "true"

  return isInput || isContentEditable
}

// ---------------------------------------------------------------------------
// Implementation: validation
// ---------------------------------------------------------------------------

const RESERVED_KEYS = ["F1", "F2", "F3", "F4", "F5", "F6", "F7", "F8", "F9", "F10", "F11", "F12"]

function validateBinding(actionId: string, binding: ShortcutBinding): string | null {
  if (!isKnownAction(actionId)) {
    return "Unknown action"
  }

  const action = DEFAULT_SHORTCUTS[actionId]

  if (action.requiresModifier && binding.modifiers.length === 0) {
    return "This shortcut requires at least one modifier key (Cmd/Ctrl, Shift, or Alt)"
  }

  if (RESERVED_KEYS.includes(binding.key)) {
    return "Function keys are reserved and cannot be used"
  }

  if (
    binding.modifiers.length === 0 &&
    binding.key.length === 1 &&
    /^[a-zA-Z0-9]$/.test(binding.key)
  ) {
    return "Single character shortcuts require a modifier key"
  }

  return null
}

function isBindingShaped(value: unknown): value is ShortcutBinding {
  if (typeof value !== "object" || value === null) return false
  const candidate = value as ShortcutBinding
  return typeof candidate.key === "string" && Array.isArray(candidate.modifiers)
}

function findConflicts(
  actionId: ShortcutActionId,
  binding: ShortcutBinding,
  custom: CustomShortcuts
): Array<{ actionId: ShortcutActionId; actionName: string }> {
  const conflicts: Array<{ actionId: ShortcutActionId; actionName: string }> = []

  for (const action of Object.values(DEFAULT_SHORTCUTS)) {
    if (action.id === actionId) continue

    const existingBinding = custom[action.id] || action.defaultBinding

    if (bindingsEqual(binding, existingBinding)) {
      conflicts.push({ actionId: action.id, actionName: action.name })
    }
  }

  return conflicts
}

// ---------------------------------------------------------------------------
// Implementation: persistence
// ---------------------------------------------------------------------------

let cachedCustom: CustomShortcuts | null = null

function readCustomFromStorage(): CustomShortcuts {
  if (typeof window === "undefined") return {}

  try {
    const stored = localStorage.getItem(SHORTCUTS_STORAGE_KEY)
    if (!stored) return {}

    const parsed: unknown = JSON.parse(stored)

    if (typeof parsed !== "object" || parsed === null) {
      return {}
    }

    // Drop entries for unknown actions or malformed bindings
    const valid: CustomShortcuts = {}
    for (const [actionId, binding] of Object.entries(parsed)) {
      if (isKnownAction(actionId) && isBindingShaped(binding)) {
        valid[actionId] = binding
      }
    }

    return valid
  } catch {
    return {}
  }
}

function customShortcuts(): CustomShortcuts {
  if (cachedCustom === null) {
    cachedCustom = readCustomFromStorage()
  }
  return cachedCustom
}

function writeCustomToStorage(next: CustomShortcuts): void {
  cachedCustom = next

  if (typeof window === "undefined") return

  try {
    localStorage.setItem(SHORTCUTS_STORAGE_KEY, JSON.stringify(next))
  } catch (error) {
    console.error("Failed to save custom shortcuts:", error)
  }
}

function effectiveBinding(actionId: ShortcutActionId): ShortcutBinding {
  const custom = customShortcuts()[actionId]
  if (custom) return custom

  const action = DEFAULT_SHORTCUTS[actionId]
  return action?.defaultBinding || { key: "", modifiers: [] }
}

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * A candidate action for `resolve`. `ShortcutHandler` from
 * `useKeyboardShortcuts` satisfies this structurally.
 */
interface ResolveCandidate {
  id: ShortcutActionId
  /** Override the action's own `allowInInput` */
  allowInInput?: boolean
  /** `false` skips the candidate entirely */
  enabled?: boolean
}

interface ResolveOptions {
  /** Candidates in priority order; defaults to every action */
  among?: readonly ResolveCandidate[]
  /** Override input-focus detection (defaults to inspecting the active element) */
  typing?: boolean
}

interface ListOptions {
  category?: ShortcutCategory
  /** Include actions marked `hidden` (default false) */
  includeHidden?: boolean
}

/**
 * The keyboard shortcut registry.
 */
export const shortcuts = {
  /**
   * Visible actions, in catalogue order. Pass `includeHidden` for the ones
   * kept out of the help modal (Escape, Enter, `?`).
   */
  list(options: ListOptions = {}): ShortcutAction[] {
    return Object.values(DEFAULT_SHORTCUTS).filter((action) => {
      if (!options.includeHidden && action.hidden) return false
      if (options.category && action.category !== options.category) return false
      return true
    })
  },

  /**
   * Visible actions grouped by category and sorted by display order. Groups
   * with no visible shortcuts are still present, with an empty list.
   */
  groups(): ShortcutGroup[] {
    const categories = Object.keys(CATEGORY_CONFIG) as ShortcutCategory[]

    return categories
      .map((category) => ({
        category,
        label: CATEGORY_CONFIG[category].label,
        description: CATEGORY_CONFIG[category].description,
        shortcuts: shortcuts.list({ category }),
      }))
      .sort((a, b) => CATEGORY_CONFIG[a.category].order - CATEGORY_CONFIG[b.category].order)
  },

  /**
   * The binding actually in force for an action: the user's custom binding if
   * they set one, otherwise the default.
   */
  binding(actionId: ShortcutActionId): ShortcutBinding {
    return effectiveBinding(actionId)
  },

  /**
   * Human-readable form of an action's effective binding, or of any binding.
   * `style: "symbol"` renders mac glyphs (⌘⇧⌥) instead of words.
   */
  display(
    target: ShortcutActionId | ShortcutBinding,
    options: { style?: "text" | "symbol" } = {}
  ): string {
    const binding = typeof target === "string" ? effectiveBinding(target) : target
    return options.style === "symbol"
      ? formatShortcutWithSymbols(binding)
      : formatShortcutBinding(binding)
  },

  /**
   * Platform-dependent display strings, for UI that names the modifier key
   * outside of a full binding.
   */
  platform(): { isMac: boolean; modifierKey: string; modifierSymbol: string } {
    return {
      isMac: isMac(),
      modifierKey: getModifierDisplay("meta"),
      modifierSymbol: getModifierSymbol("meta"),
    }
  },

  /**
   * The action a key event should trigger, or null. Candidates are tried in
   * order; a candidate is skipped when `enabled === false`, or when the user
   * is typing in an input and the action does not allow that.
   */
  resolve(event: KeyboardEvent, options: ResolveOptions = {}): ShortcutActionId | null {
    const candidates: readonly ResolveCandidate[] =
      options.among ?? Object.values(DEFAULT_SHORTCUTS).map((action) => ({ id: action.id }))
    const typing = options.typing ?? isTypingInInput()

    for (const candidate of candidates) {
      if (candidate.enabled === false) continue

      if (!isKnownAction(candidate.id)) continue
      const action = DEFAULT_SHORTCUTS[candidate.id]

      const allowInInput = candidate.allowInInput ?? action.allowInInput ?? false
      if (typing && !allowInInput) continue

      if (eventMatchesBinding(event, effectiveBinding(candidate.id))) {
        return candidate.id
      }
    }

    return null
  },

  /**
   * Whether a key event triggers a specific binding. Suppressed while the
   * user is typing in an input unless `allowInInput` is set. For bindings
   * that are not registry actions (ad-hoc, component-local shortcuts).
   */
  matches(
    event: KeyboardEvent,
    binding: ShortcutBinding,
    options: { allowInInput?: boolean; typing?: boolean } = {}
  ): boolean {
    const typing = options.typing ?? isTypingInInput()
    if (typing && !options.allowInInput) return false

    return eventMatchesBinding(event, binding)
  },

  /**
   * Point an action at a new binding and persist it. Refused when the binding
   * is invalid, or when another action already answers to it — pass
   * `{ force: true }` to take it anyway. Conflicts are reported either way.
   */
  rebind(
    actionId: ShortcutActionId,
    binding: ShortcutBinding,
    options: { force?: boolean } = {}
  ): RebindResult {
    const error = validateBinding(actionId, binding)
    if (error) {
      return { ok: false, error }
    }

    const conflicts = findConflicts(actionId, binding, customShortcuts())
    if (conflicts.length > 0 && !options.force) {
      return { ok: false, error: "This shortcut is already in use", conflicts }
    }

    writeCustomToStorage({ ...customShortcuts(), [actionId]: binding })

    return conflicts.length > 0 ? { ok: true, conflicts } : { ok: true }
  },

  /**
   * Drop the custom binding for one action, or for every action when called
   * with no argument, returning them to their defaults.
   */
  reset(actionId?: ShortcutActionId): void {
    if (!actionId) {
      writeCustomToStorage({})
      return
    }

    const { [actionId]: _removed, ...rest } = customShortcuts()
    writeCustomToStorage(rest)
  },

  /** Whether shortcut handling is switched on (persisted, defaults to true). */
  isEnabled(): boolean {
    if (typeof window === "undefined") return true

    try {
      return localStorage.getItem(SHORTCUTS_ENABLED_KEY) !== "false"
    } catch {
      return true
    }
  },

  /** Switch shortcut handling on or off and persist the choice. */
  setEnabled(enabled: boolean): void {
    if (typeof window === "undefined") return

    try {
      localStorage.setItem(SHORTCUTS_ENABLED_KEY, String(enabled))
    } catch (error) {
      console.error("Failed to save shortcuts enabled state:", error)
    }
  },

  /** The user's custom bindings as a JSON document, for backup or transfer. */
  exportConfig(): string {
    return JSON.stringify(
      {
        version: 1,
        shortcuts: customShortcuts(),
        exportedAt: new Date().toISOString(),
      },
      null,
      2
    )
  },

  /**
   * Replace the custom bindings from a JSON document produced by
   * `exportConfig` (a bare `{ actionId: binding }` map is also accepted).
   * Untrusted input: unknown actions and bindings that fail validation are
   * dropped, and only unreadable input fails outright.
   */
  importConfig(json: string): ImportResult {
    let data: unknown
    try {
      data = JSON.parse(json)
    } catch {
      return { ok: false, error: "Invalid JSON format" }
    }

    if (typeof data !== "object" || data === null) {
      return { ok: false, error: "Invalid import format" }
    }

    // Accept both the wrapped export format and a bare binding map
    const payload = (data as { shortcuts?: unknown }).shortcuts || data

    if (typeof payload !== "object" || payload === null) {
      return { ok: false, error: "Invalid shortcuts data" }
    }

    const valid: CustomShortcuts = {}
    for (const [actionId, binding] of Object.entries(payload)) {
      if (!isKnownAction(actionId)) continue
      if (!isBindingShaped(binding)) continue
      if (validateBinding(actionId, binding)) continue

      valid[actionId] = binding
    }

    writeCustomToStorage(valid)

    return { ok: true, applied: Object.keys(valid).length }
  },

  /**
   * Re-read persisted bindings from storage, discarding the in-memory copy.
   * Needed when another tab (or a test) writes storage directly.
   */
  reload(): void {
    cachedCustom = null
  },
}
