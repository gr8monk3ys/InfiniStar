"use client"

import { useEffect } from "react"
import posthog from "posthog-js"

interface CharacterViewedTrackerProps {
  characterId: string
  slug: string
  category: string
  isNsfw: boolean
}

/**
 * Fires the `character_viewed` PostHog event once when the (server-rendered)
 * public character page mounts on the client. Renders nothing.
 */
export function CharacterViewedTracker({
  characterId,
  slug,
  category,
  isNsfw,
}: CharacterViewedTrackerProps) {
  useEffect(() => {
    posthog.capture("character_viewed", { characterId, slug, category, isNsfw })
    // Fire once per page view; props are stable for a given character page.
  }, [])

  return null
}
