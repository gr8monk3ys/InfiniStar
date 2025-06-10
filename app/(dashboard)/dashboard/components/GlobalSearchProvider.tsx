"use client"

import { createContext, useContext, type ReactNode } from "react"
import dynamic from "next/dynamic"

import { useGlobalSearch } from "../hooks/useGlobalSearch"

/**
 * Lazy load GlobalSearchModal for better bundle size
 * Only loads when the modal is opened
 */
const GlobalSearchModal = dynamic(() => import("@/app/components/modals/GlobalSearchModal"), {
  ssr: false,
  loading: () => null,
})

/**
 * Global Search Context
 *
 * Provides access to the global search modal state and controls
 * throughout the dashboard.
 */
interface GlobalSearchContextType {
  isOpen: boolean
  open: () => void
  close: () => void
  toggle: () => void
}

const GlobalSearchContext = createContext<GlobalSearchContextType | null>(null)

/**
 * Hook to access global search controls
 *
 * @example
 * ```tsx
 * const { open } = useGlobalSearchContext()
 * return <button onClick={open}>Search</button>
 * ```
 */
export function useGlobalSearchContext(): GlobalSearchContextType {
  const context = useContext(GlobalSearchContext)
  if (!context) {
    throw new Error("useGlobalSearchContext must be used within a GlobalSearchProvider")
  }
  return context
}

interface GlobalSearchProviderProps {
  children: ReactNode
}

/**
 * Global Search Provider
 *
 * Wraps the dashboard to provide global search functionality.
 * Includes the search modal and keyboard shortcut listener (Cmd/Ctrl+K).
 */
export function GlobalSearchProvider({ children }: GlobalSearchProviderProps) {
  const { isOpen, open, close, toggle } = useGlobalSearch()

  return (
    <GlobalSearchContext.Provider value={{ isOpen, open, close, toggle }}>
      {children}
      {/* Only render modal when open to benefit from lazy loading */}
      {isOpen && <GlobalSearchModal isOpen={isOpen} onClose={close} />}
    </GlobalSearchContext.Provider>
  )
}

export default GlobalSearchProvider
