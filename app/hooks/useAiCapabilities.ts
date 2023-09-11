"use client"

import { useEffect, useState } from "react"

import { api } from "@/app/lib/api-client"

export interface AiCapabilities {
  imageGeneration: boolean
  voiceTranscription: boolean
}

/**
 * Optimistic defaults used while the capabilities request is in flight.
 *
 * Deliberately `true` so fully-configured deployments never see the composer
 * buttons flash out and back in on mount. Buttons are hidden only after the
 * server explicitly reports a capability as unavailable.
 */
export const DEFAULT_AI_CAPABILITIES: AiCapabilities = {
  imageGeneration: true,
  voiceTranscription: true,
}

// Module-level cache so capabilities are fetched at most once per page load,
// shared across every component instance that uses the hook.
let cachedCapabilities: AiCapabilities | null = null
let inflightRequest: Promise<AiCapabilities> | null = null

/** Test-only helper: clears the module-level cache between tests. */
export function resetAiCapabilitiesCacheForTests(): void {
  cachedCapabilities = null
  inflightRequest = null
}

function fetchAiCapabilities(): Promise<AiCapabilities> {
  if (cachedCapabilities) {
    return Promise.resolve(cachedCapabilities)
  }

  if (!inflightRequest) {
    inflightRequest = api
      .get<Partial<AiCapabilities>>("/api/ai/capabilities", {
        retries: 1,
        showErrorToast: false,
      })
      .then((data) => {
        const capabilities: AiCapabilities = {
          imageGeneration: data?.imageGeneration === true,
          voiceTranscription: data?.voiceTranscription === true,
        }
        cachedCapabilities = capabilities
        return capabilities
      })
      .catch(() => {
        // On failure, fall back to the optimistic defaults (buttons stay
        // visible, server routes still enforce configuration) and clear the
        // in-flight promise so a later mount can retry.
        inflightRequest = null
        return DEFAULT_AI_CAPABILITIES
      })
  }

  return inflightRequest
}

/**
 * Reports which optional AI media features (image generation, voice
 * transcription) are configured server-side, so the UI can hide buttons that
 * would otherwise fail with "not configured" errors.
 *
 * Defaults to all-enabled while loading; flips to the server-reported values
 * once `/api/ai/capabilities` responds. The response is cached for the
 * lifetime of the page, so the network request happens at most once.
 */
export function useAiCapabilities(): { capabilities: AiCapabilities; isLoaded: boolean } {
  const [capabilities, setCapabilities] = useState<AiCapabilities>(
    () => cachedCapabilities ?? DEFAULT_AI_CAPABILITIES
  )
  const [isLoaded, setIsLoaded] = useState<boolean>(() => cachedCapabilities !== null)

  useEffect(() => {
    if (cachedCapabilities) {
      return
    }

    let isMounted = true

    void fetchAiCapabilities().then((result) => {
      if (isMounted) {
        setCapabilities(result)
        setIsLoaded(true)
      }
    })

    return () => {
      isMounted = false
    }
  }, [])

  return { capabilities, isLoaded }
}
