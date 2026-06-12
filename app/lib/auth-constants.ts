export const FALLBACK_AUTH_COOKIE_NAME = "infinistar_fallback_session"
export const FALLBACK_AUTH_CLERK_ID_PREFIX = "fallback_"
export const FALLBACK_AUTH_SESSION_DAYS = 30

// Lives here (not in fallback-auth.ts) so the Edge middleware can check the flag
// without pulling Prisma/pg/bcrypt into its bundle — Node-only modules crash the
// Edge runtime at request time.
export function isFallbackAuthEnabled() {
  const value = process.env.ENABLE_FALLBACK_AUTH?.trim().toLowerCase()
  return value === "1" || value === "true" || value === "yes" || value === "on"
}
