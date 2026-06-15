import { PostHog } from "posthog-node"

import { apiLogger } from "@/app/lib/logger"

let _client: PostHog | null | undefined

// Lazily construct a PostHog client on first use. Returns null (and stays null)
// when POSTHOG_API_KEY is unset so analytics safely no-ops in dev/CI and never
// constructs a client at module-load time. Mirrors the lazy-init pattern in
// app/lib/anthropic.ts.
function getPostHogClient(): PostHog | null {
  if (_client !== undefined) {
    return _client
  }

  const apiKey = process.env.POSTHOG_API_KEY
  if (!apiKey) {
    _client = null
    return _client
  }

  _client = new PostHog(apiKey, {
    host: process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com",
    // Server routes are short-lived; flush eagerly so events are not lost when
    // the function instance is torn down.
    flushAt: 1,
    flushInterval: 0,
  })
  return _client
}

/**
 * Fire-and-forget server-side analytics capture.
 *
 * Never throws into the caller: a misconfigured or failing analytics backend
 * must never break a product request (sending a message, creating a chat, etc.).
 * No-ops silently when POSTHOG_API_KEY is unset.
 */
export function captureServerEvent(
  distinctId: string,
  event: string,
  properties?: Record<string, unknown>
): void {
  try {
    const client = getPostHogClient()
    if (!client) {
      return
    }
    client.capture({
      distinctId,
      event,
      properties: properties ?? {},
    })
  } catch (error) {
    apiLogger.warn({ err: error, event }, "ANALYTICS_CAPTURE_FAILED")
  }
}
