"use client"

import { useEffect, useState } from "react"

import { getClientCsrfToken } from "@/app/lib/csrf-client"

/**
 * Hook to fetch and manage CSRF token
 *
 * @returns {Object} Object containing token and loading state
 * @property {string | null} token - The CSRF token
 * @property {boolean} loading - Whether the token is being fetched
 * @property {Error | null} error - Any error that occurred during fetch
 *
 * @example
 * const { token, loading } = useCsrfToken();
 *
 * if (loading) return <div>Loading...</div>;
 *
 * // Use token in API calls
 * fetch('/api/messages', {
 *   method: 'POST',
 *   headers: { 'X-CSRF-Token': token },
 *   body: JSON.stringify(data)
 * });
 */
export function useCsrfToken() {
  const [token, setToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    let isMounted = true

    async function fetchToken() {
      try {
        const token = await getClientCsrfToken()
        if (isMounted) {
          if (!token) {
            setError(new Error("Failed to fetch CSRF token"))
            setToken(null)
            return
          }

          setToken(token)
          setError(null)
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err : new Error("Unknown error"))
          console.error("Error fetching CSRF token:", err)
        }
      } finally {
        if (isMounted) {
          setLoading(false)
        }
      }
    }

    fetchToken()

    return () => {
      isMounted = false
    }
  }, [])

  return { token, loading, error }
}

/**
 * Helper function to add CSRF token to fetch headers
 *
 * @param token - The CSRF token
 * @param headers - Existing headers (optional)
 * @returns Headers object with CSRF token included
 *
 * @example
 * const { token } = useCsrfToken();
 *
 * fetch('/api/messages', {
 *   method: 'POST',
 *   headers: withCsrfHeader(token, { 'Content-Type': 'application/json' }),
 *   body: JSON.stringify(data)
 * });
 */
export function withCsrfHeader(
  token: string | null,
  headers: Record<string, string> = {}
): Record<string, string> {
  if (!token) {
    return headers
  }

  return {
    ...headers,
    "X-CSRF-Token": token,
  }
}
