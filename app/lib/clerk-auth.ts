function isEnabled(value?: string) {
  if (!value) {
    return false
  }

  const normalized = value.trim().toLowerCase()
  return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on"
}

function getFirstValue(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value
}

export function isClerkClientConfigured() {
  return Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY)
}

export function isClerkSatellite() {
  return isEnabled(process.env.NEXT_PUBLIC_CLERK_IS_SATELLITE)
}

export function getClerkSignInUrl() {
  return process.env.NEXT_PUBLIC_CLERK_SIGN_IN_URL || "/sign-in"
}

export function getClerkSignUpUrl() {
  return process.env.NEXT_PUBLIC_CLERK_SIGN_UP_URL || "/sign-up"
}

export function getSafePostAuthPath(value?: string | string[], fallbackPath = "/dashboard") {
  const candidate = getFirstValue(value)?.trim()

  if (!candidate) {
    return fallbackPath
  }

  if (!candidate.startsWith("/")) {
    return fallbackPath
  }

  if (candidate.startsWith("//")) {
    return fallbackPath
  }

  return candidate
}
