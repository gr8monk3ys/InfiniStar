"use client"

import { useCallback, useState } from "react"

/**
 * useGlobalSearch Hook
 *
 * Manages global search modal state.
 * The keyboard shortcut (Cmd/Ctrl+K) is handled by KeyboardShortcutsProvider.
 *
 * @example
 * ```tsx
 * const { isOpen, open, close, toggle } = useGlobalSearch()
 * ```
 */
export function useGlobalSearch() {
  const [isOpen, setIsOpen] = useState(false)

  const open = useCallback(() => setIsOpen(true), [])
  const close = useCallback(() => setIsOpen(false), [])
  const toggle = useCallback(() => setIsOpen((prev) => !prev), [])

  return {
    isOpen,
    open,
    close,
    toggle,
  }
}

export default useGlobalSearch
