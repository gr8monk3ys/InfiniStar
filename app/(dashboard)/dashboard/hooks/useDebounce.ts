"use client"

import { useEffect, useState } from "react"

/**
 * useDebounce Hook
 *
 * Debounces a value by the specified delay.
 * Useful for search inputs to avoid making too many API calls.
 *
 * @param value - The value to debounce
 * @param delay - Delay in milliseconds (default: 300ms)
 * @returns The debounced value
 *
 * @example
 * ```tsx
 * const [query, setQuery] = useState('')
 * const debouncedQuery = useDebounce(query, 300)
 *
 * useEffect(() => {
 *   if (debouncedQuery) {
 *     // Make API call
 *   }
 * }, [debouncedQuery])
 * ```
 */
export function useDebounce<T>(value: T, delay: number = 300): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value)

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)

    return () => {
      clearTimeout(handler)
    }
  }, [value, delay])

  return debouncedValue
}

export default useDebounce
