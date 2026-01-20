/**
 * Two-Factor Authentication Token Management
 *
 * Manages temporary 2FA tokens used during the login flow.
 * In production, use Redis or another distributed cache instead of in-memory storage.
 */

/**
 * In-memory store for 2FA login tokens
 * In production, use Redis or another distributed cache
 */
const twoFactorTokenStore = new Map<string, { token: string; expiresAt: number }>()

// Clean up expired tokens every minute
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now()
    for (const [email, data] of twoFactorTokenStore.entries()) {
      if (data.expiresAt < now) {
        twoFactorTokenStore.delete(email)
      }
    }
  }, 60000)
}

/**
 * Store a 2FA token for the login flow
 */
export async function store2FAToken(email: string, token: string): Promise<void> {
  const expiresAt = Date.now() + 5 * 60 * 1000 // 5 minutes
  twoFactorTokenStore.set(email.toLowerCase(), { token, expiresAt })
}

/**
 * Get a stored 2FA token
 */
export async function get2FAToken(email: string): Promise<string | null> {
  const data = twoFactorTokenStore.get(email.toLowerCase())
  if (!data) return null
  if (data.expiresAt < Date.now()) {
    twoFactorTokenStore.delete(email.toLowerCase())
    return null
  }
  return data.token
}

/**
 * Clear a 2FA token
 */
export async function clear2FAToken(email: string): Promise<void> {
  twoFactorTokenStore.delete(email.toLowerCase())
}
