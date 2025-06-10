let cachedToken: string | null = null
let inflight: Promise<string | null> | null = null

/**
 * Client-side CSRF token getter with in-memory caching.
 *
 * The CSRF cookie is HttpOnly, so the client must fetch `/api/csrf` to obtain
 * the matching token value to send in `X-CSRF-Token`.
 */
export async function getClientCsrfToken(): Promise<string | null> {
  // Only meaningful in the browser.
  if (typeof window === "undefined") return null

  if (cachedToken) return cachedToken
  if (inflight) return inflight

  inflight = fetch("/api/csrf", { credentials: "include" })
    .then(async (res) => {
      if (!res.ok) return null
      const data = (await res.json()) as { token?: string } | null
      cachedToken = data?.token ?? null
      return cachedToken
    })
    .catch(() => null)
    .finally(() => {
      inflight = null
    })

  return inflight
}

export function clearClientCsrfTokenCache() {
  cachedToken = null
  inflight = null
}
