"use client"

import { createContext, useCallback, useContext, useMemo, useReducer, type ReactNode } from "react"
import dynamic from "next/dynamic"
import { useRouter } from "next/navigation"
import { useTheme } from "next-themes"

import {
  type ShortcutAction,
  type ShortcutActionId,
  type ShortcutBinding,
  type ShortcutCategory,
} from "@/app/lib/shortcuts"
import { useKeyboardShortcuts, type ShortcutHandler } from "@/app/hooks/useKeyboardShortcuts"

import { useGlobalSearchContext } from "./GlobalSearchProvider"

// Lazy-load the shortcuts help modal -- only shown on user action (Cmd+/)
const KeyboardShortcutsModal = dynamic(
  () => import("@/app/components/modals/KeyboardShortcutsModal"),
  {
    ssr: false,
    loading: () => null,
  }
)

const PersonalitySelectionModal = dynamic(
  () => import("@/app/components/modals/PersonalitySelectionModal"),
  {
    ssr: false,
    loading: () => null,
  }
)

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
  /** Set the href that should be opened for the currently keyboard-selected conversation */
  setSelectedConversationHref: (href: string | null) => void
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

interface KeyboardShortcutsState {
  isHelpOpen: boolean
  selectedConversationIndex: number
  conversationCount: number
  isNewAIConversationOpen: boolean
  messageInputRef: React.RefObject<HTMLTextAreaElement> | null
  messageContainerRef: React.RefObject<HTMLDivElement> | null
  selectedConversationHref: string | null
}

type KeyboardShortcutsAction =
  | { type: "open_help" }
  | { type: "close_help" }
  | { type: "toggle_help" }
  | { type: "open_new_ai_conversation" }
  | { type: "close_new_ai_conversation" }
  | { type: "set_selected_conversation_index"; index: number }
  | { type: "set_conversation_count"; count: number }
  | { type: "select_next_conversation" }
  | { type: "select_prev_conversation" }
  | { type: "set_message_input_ref"; ref: React.RefObject<HTMLTextAreaElement> }
  | { type: "set_message_container_ref"; ref: React.RefObject<HTMLDivElement> }
  | { type: "set_selected_conversation_href"; href: string | null }

const initialKeyboardShortcutsState: KeyboardShortcutsState = {
  isHelpOpen: false,
  selectedConversationIndex: -1,
  conversationCount: 0,
  isNewAIConversationOpen: false,
  messageInputRef: null,
  messageContainerRef: null,
  selectedConversationHref: null,
}

function clampConversationIndex(index: number, count: number) {
  if (count <= 0) {
    return -1
  }

  return Math.min(Math.max(index, 0), count - 1)
}

function keyboardShortcutsReducer(
  state: KeyboardShortcutsState,
  action: KeyboardShortcutsAction
): KeyboardShortcutsState {
  switch (action.type) {
    case "open_help":
      return { ...state, isHelpOpen: true }
    case "close_help":
      return { ...state, isHelpOpen: false }
    case "toggle_help":
      return { ...state, isHelpOpen: !state.isHelpOpen }
    case "open_new_ai_conversation":
      return { ...state, isNewAIConversationOpen: true }
    case "close_new_ai_conversation":
      return { ...state, isNewAIConversationOpen: false }
    case "set_selected_conversation_index":
      return {
        ...state,
        selectedConversationIndex: clampConversationIndex(action.index, state.conversationCount),
      }
    case "set_conversation_count":
      return {
        ...state,
        conversationCount: action.count,
        selectedConversationIndex: clampConversationIndex(
          state.selectedConversationIndex,
          action.count
        ),
      }
    case "select_next_conversation":
      return {
        ...state,
        selectedConversationIndex: clampConversationIndex(
          state.selectedConversationIndex + 1,
          state.conversationCount
        ),
      }
    case "select_prev_conversation":
      return {
        ...state,
        selectedConversationIndex: clampConversationIndex(
          state.selectedConversationIndex - 1,
          state.conversationCount
        ),
      }
    case "set_message_input_ref":
      return { ...state, messageInputRef: action.ref }
    case "set_message_container_ref":
      return { ...state, messageContainerRef: action.ref }
    case "set_selected_conversation_href":
      return { ...state, selectedConversationHref: action.href }
    default:
      return state
  }
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
  const [state, dispatch] = useReducer(keyboardShortcutsReducer, initialKeyboardShortcutsState)

  // Get global search context
  const searchContext = useGlobalSearchContext()

  // Modal controls
  const openHelp = useCallback(() => dispatch({ type: "open_help" }), [])
  const closeHelp = useCallback(() => dispatch({ type: "close_help" }), [])
  const toggleHelp = useCallback(() => dispatch({ type: "toggle_help" }), [])
  const openNewAIConversation = useCallback(
    () => dispatch({ type: "open_new_ai_conversation" }),
    []
  )
  const closeNewAIConversation = useCallback(
    () => dispatch({ type: "close_new_ai_conversation" }),
    []
  )
  const setSelectedConversationIndex = useCallback((index: number) => {
    dispatch({ type: "set_selected_conversation_index", index })
  }, [])
  const setConversationCount = useCallback((count: number) => {
    dispatch({ type: "set_conversation_count", count })
  }, [])
  const setMessageInputRef = useCallback((ref: React.RefObject<HTMLTextAreaElement>) => {
    dispatch({ type: "set_message_input_ref", ref })
  }, [])
  const setMessageContainerRef = useCallback((ref: React.RefObject<HTMLDivElement>) => {
    dispatch({ type: "set_message_container_ref", ref })
  }, [])
  const setSelectedConversationHref = useCallback((href: string | null) => {
    dispatch({ type: "set_selected_conversation_href", href })
  }, [])

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
          if (state.isHelpOpen) {
            closeHelp()
          } else if (searchContext.isOpen) {
            searchContext.close()
          } else if (state.isNewAIConversationOpen) {
            closeNewAIConversation()
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
        action: () => dispatch({ type: "select_next_conversation" }),
      },
      {
        id: "prevConversation",
        action: () => dispatch({ type: "select_prev_conversation" }),
      },
      {
        id: "openConversation",
        action: () => {
          if (state.selectedConversationHref) {
            router.push(state.selectedConversationHref)
          }
        },
      },

      // Message shortcuts
      {
        id: "focusInput",
        action: () => {
          state.messageInputRef?.current?.focus()
        },
      },
      {
        id: "scrollToBottom",
        action: () => {
          state.messageContainerRef?.current?.scrollTo({
            top: state.messageContainerRef.current.scrollHeight,
            behavior: "smooth",
          })
        },
      },
    ],
    [
      searchContext,
      toggleHelp,
      state.isHelpOpen,
      closeHelp,
      state.isNewAIConversationOpen,
      closeNewAIConversation,
      openNewAIConversation,
      state.selectedConversationHref,
      router,
      setTheme,
      resolvedTheme,
      state.messageInputRef,
      state.messageContainerRef,
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
    enabled: !state.isHelpOpen,
  })

  // Context value
  const contextValue = useMemo<KeyboardShortcutsContextType>(
    () => ({
      isHelpOpen: state.isHelpOpen,
      openHelp,
      closeHelp,
      toggleHelp,
      shortcuts,
      byCategory,
      selectedConversationIndex: state.selectedConversationIndex,
      setSelectedConversationIndex,
      conversationCount: state.conversationCount,
      setConversationCount,
      openNewAIConversation,
      shortcutsEnabled,
      setShortcutsEnabled,
      getBinding,
      formatBinding,
      modifierKey,
      messageInputRef: state.messageInputRef,
      setMessageInputRef,
      messageContainerRef: state.messageContainerRef,
      setMessageContainerRef,
      setSelectedConversationHref,
    }),
    [
      state.isHelpOpen,
      openHelp,
      closeHelp,
      toggleHelp,
      shortcuts,
      byCategory,
      state.selectedConversationIndex,
      state.conversationCount,
      openNewAIConversation,
      shortcutsEnabled,
      setShortcutsEnabled,
      getBinding,
      formatBinding,
      modifierKey,
      state.messageInputRef,
      state.messageContainerRef,
      setSelectedConversationHref,
    ]
  )

  return (
    <KeyboardShortcutsContext.Provider value={contextValue}>
      {children}
      {state.isHelpOpen && <KeyboardShortcutsModal isOpen={state.isHelpOpen} onClose={closeHelp} />}
      {state.isNewAIConversationOpen && (
        <PersonalitySelectionModal
          isOpen={state.isNewAIConversationOpen}
          onClose={closeNewAIConversation}
        />
      )}
    </KeyboardShortcutsContext.Provider>
  )
}

export default KeyboardShortcutsProvider
