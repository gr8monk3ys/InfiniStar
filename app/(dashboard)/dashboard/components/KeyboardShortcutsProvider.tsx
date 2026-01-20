"use client"

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react"
import { useRouter } from "next/navigation"
import { useTheme } from "next-themes"

import {
  type ShortcutAction,
  type ShortcutActionId,
  type ShortcutBinding,
  type ShortcutCategory,
} from "@/app/lib/shortcuts"
import KeyboardShortcutsModal from "@/app/components/modals/KeyboardShortcutsModal"
import { useKeyboardShortcuts, type ShortcutHandler } from "@/app/hooks/useKeyboardShortcuts"

import { useGlobalSearchContext } from "./GlobalSearchProvider"

/**
 * Keyboard Shortcuts Context
 *
 * Provides access to keyboard shortcuts state and the help modal
 * throughout the dashboard.
 */
interface KeyboardShortcutsContextType {
  /** Whether the shortcuts help modal is open */
  isHelpOpen: boolean
  /** Open the shortcuts help modal */
  openHelp: () => void
  /** Close the shortcuts help modal */
  closeHelp: () => void
  /** Toggle the shortcuts help modal */
  toggleHelp: () => void
  /** All available shortcuts (visible in help modal) */
  shortcuts: ShortcutAction[]
  /** Shortcuts grouped by category */
  byCategory: Record<ShortcutCategory, ShortcutAction[]>
  /** Current selected conversation index (for keyboard navigation) */
  selectedConversationIndex: number
  /** Set the selected conversation index */
  setSelectedConversationIndex: (index: number) => void
  /** Total number of conversations (for navigation bounds) */
  conversationCount: number
  /** Set the total number of conversations */
  setConversationCount: (count: number) => void
  /** Open a new AI conversation modal */
  openNewAIConversation: () => void
  /** Set the callback for opening new AI conversation */
  setOpenNewAIConversation: (callback: () => void) => void
  /** Whether shortcuts are globally enabled */
  shortcutsEnabled: boolean
  /** Toggle global shortcuts enabled state */
  setShortcutsEnabled: (enabled: boolean) => void
  /** Get the binding for a specific action */
  getBinding: (actionId: ShortcutActionId) => ShortcutBinding
  /** Format a binding for display */
  formatBinding: (actionId: ShortcutActionId) => string
  /** Platform modifier key display (Cmd or Ctrl) */
  modifierKey: string
  /** Reference to the message input element for focusing */
  messageInputRef: React.RefObject<HTMLTextAreaElement> | null
  /** Set the message input ref */
  setMessageInputRef: (ref: React.RefObject<HTMLTextAreaElement>) => void
  /** Reference to the message container for scrolling */
  messageContainerRef: React.RefObject<HTMLDivElement> | null
  /** Set the message container ref */
  setMessageContainerRef: (ref: React.RefObject<HTMLDivElement>) => void
}

const KeyboardShortcutsContext = createContext<KeyboardShortcutsContextType | null>(null)

/**
 * Hook to access keyboard shortcuts context
 *
 * @example
 * ```tsx
 * const { openHelp, shortcuts, formatBinding } = useKeyboardShortcutsContext()
 * return <button onClick={openHelp}>Show Shortcuts ({formatBinding('showHelp')})</button>
 * ```
 */
export function useKeyboardShortcutsContext(): KeyboardShortcutsContextType {
  const context = useContext(KeyboardShortcutsContext)
  if (!context) {
    throw new Error("useKeyboardShortcutsContext must be used within a KeyboardShortcutsProvider")
  }
  return context
}

interface KeyboardShortcutsProviderProps {
  children: ReactNode
}

/**
 * KeyboardShortcutsProvider
 *
 * Provides global keyboard shortcut handling for the dashboard.
 * Includes the help modal and all shortcut definitions.
 *
 * Shortcuts:
 * - Cmd/Ctrl + K: Open global search
 * - Cmd/Ctrl + N: New AI conversation
 * - Cmd/Ctrl + / or ?: Show keyboard shortcuts help
 * - Escape: Close modals/dialogs
 * - Cmd/Ctrl + Up/Down: Navigate conversations
 * - Cmd/Ctrl + I: Focus message input
 * - Cmd/Ctrl + Shift + D: Toggle theme
 */
export function KeyboardShortcutsProvider({ children }: KeyboardShortcutsProviderProps) {
  const router = useRouter()
  const { setTheme, resolvedTheme } = useTheme()

  // Modal state
  const [isHelpOpen, setIsHelpOpen] = useState(false)

  // Navigation state
  const [selectedConversationIndex, setSelectedConversationIndex] = useState(-1)
  const [conversationCount, setConversationCount] = useState(0)

  // Callback refs
  const [openNewAIConversationCallback, setOpenNewAIConversationCallback] = useState<() => void>(
    () => () => {}
  )
  const [messageInputRef, setMessageInputRef] =
    useState<React.RefObject<HTMLTextAreaElement> | null>(null)
  const [messageContainerRef, setMessageContainerRef] =
    useState<React.RefObject<HTMLDivElement> | null>(null)

  // Get global search context
  const searchContext = useGlobalSearchContext()

  // Modal controls
  const openHelp = useCallback(() => setIsHelpOpen(true), [])
  const closeHelp = useCallback(() => setIsHelpOpen(false), [])
  const toggleHelp = useCallback(() => setIsHelpOpen((prev) => !prev), [])

  // Callback setters
  const setOpenNewAIConversation = useCallback((callback: () => void) => {
    setOpenNewAIConversationCallback(() => callback)
  }, [])

  const openNewAIConversation = useCallback(() => {
    openNewAIConversationCallback()
  }, [openNewAIConversationCallback])

  // Define shortcut handlers
  const handlers = useMemo<ShortcutHandler[]>(
    () => [
      // Navigation shortcuts
      {
        id: "globalSearch",
        action: searchContext.toggle,
      },
      {
        id: "showHelp",
        action: toggleHelp,
      },
      {
        id: "showHelpQuestion",
        action: toggleHelp,
      },
      {
        id: "closeModal",
        action: () => {
          if (isHelpOpen) {
            closeHelp()
          } else if (searchContext.isOpen) {
            searchContext.close()
          }
        },
      },
      {
        id: "settings",
        action: () => {
          router.push("/dashboard/profile")
        },
      },
      {
        id: "toggleTheme",
        action: () => {
          setTheme(resolvedTheme === "dark" ? "light" : "dark")
        },
      },

      // Conversation shortcuts
      {
        id: "newConversation",
        action: openNewAIConversation,
      },
      {
        id: "nextConversation",
        action: () => {
          if (conversationCount > 0) {
            setSelectedConversationIndex((prev) => Math.min(conversationCount - 1, prev + 1))
          }
        },
      },
      {
        id: "prevConversation",
        action: () => {
          setSelectedConversationIndex((prev) => Math.max(0, prev - 1))
        },
      },

      // Message shortcuts
      {
        id: "focusInput",
        action: () => {
          messageInputRef?.current?.focus()
        },
      },
      {
        id: "scrollToBottom",
        action: () => {
          messageContainerRef?.current?.scrollTo({
            top: messageContainerRef.current.scrollHeight,
            behavior: "smooth",
          })
        },
      },
    ],
    [
      searchContext,
      toggleHelp,
      isHelpOpen,
      closeHelp,
      openNewAIConversation,
      conversationCount,
      router,
      setTheme,
      resolvedTheme,
      messageInputRef,
      messageContainerRef,
    ]
  )

  // Register keyboard shortcuts (disabled when help modal is open)
  const {
    enabled: shortcutsEnabled,
    setEnabled: setShortcutsEnabled,
    getBinding,
    formatBinding,
    shortcuts,
    byCategory,
    modifierKey,
  } = useKeyboardShortcuts({
    handlers,
    enabled: !isHelpOpen,
  })

  // Context value
  const contextValue = useMemo<KeyboardShortcutsContextType>(
    () => ({
      isHelpOpen,
      openHelp,
      closeHelp,
      toggleHelp,
      shortcuts,
      byCategory,
      selectedConversationIndex,
      setSelectedConversationIndex,
      conversationCount,
      setConversationCount,
      openNewAIConversation,
      setOpenNewAIConversation,
      shortcutsEnabled,
      setShortcutsEnabled,
      getBinding,
      formatBinding,
      modifierKey,
      messageInputRef,
      setMessageInputRef,
      messageContainerRef,
      setMessageContainerRef,
    }),
    [
      isHelpOpen,
      openHelp,
      closeHelp,
      toggleHelp,
      shortcuts,
      byCategory,
      selectedConversationIndex,
      conversationCount,
      openNewAIConversation,
      setOpenNewAIConversation,
      shortcutsEnabled,
      setShortcutsEnabled,
      getBinding,
      formatBinding,
      modifierKey,
      messageInputRef,
      messageContainerRef,
    ]
  )

  return (
    <KeyboardShortcutsContext.Provider value={contextValue}>
      {children}
      <KeyboardShortcutsModal isOpen={isHelpOpen} onClose={closeHelp} />
    </KeyboardShortcutsContext.Provider>
  )
}

export default KeyboardShortcutsProvider
