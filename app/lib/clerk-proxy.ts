const DEFAULT_CLERK_FRONTEND_API_ORIGIN = "https://frontend-api.clerk.dev"

export function parseClerkFrontendApiOrigin(key?: string) {
  if (!key) {
    return null
  }

  const match = key.match(/^pk_(?:test|live)_(.+)$/)
  if (!match) {
    return null
  }

  try {
    const encoded = match[1].replace(/-/g, "+").replace(/_/g, "/")
    const padding = "=".repeat((4 - (encoded.length % 4)) % 4)
    const decoded = Buffer.from(`${encoded}${padding}`, "base64").toString("utf8")
    const frontendApi = decoded.split("$")[0]?.trim()

    if (!frontendApi) {
      return null
    }

    const url = new URL(
      frontendApi.startsWith("http://") || frontendApi.startsWith("https://")
        ? frontendApi
        : `https://${frontendApi}`
    )

    return url.toString().replace(/\/$/, "")
  } catch {
    return null
  }
}

export function getClerkFrontendApiOrigin() {
  return (
    parseClerkFrontendApiOrigin(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) ??
    DEFAULT_CLERK_FRONTEND_API_ORIGIN
  )
}
