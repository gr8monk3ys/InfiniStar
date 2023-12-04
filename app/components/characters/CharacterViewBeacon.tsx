"use client"

import { useEffect, useRef } from "react"

interface CharacterViewBeaconProps {
  characterId: string
}

/**
 * Fires a single view-tracking request on mount. Rendered inside the (now ISR-cached)
 * character page so view counting survives the move off `force-dynamic`. The ref guard
 * makes it idempotent across React Strict Mode's double-invoke in development.
 */
export function CharacterViewBeacon({ characterId }: CharacterViewBeaconProps): null {
  const sentRef = useRef(false)

  useEffect(() => {
    if (sentRef.current) return
    sentRef.current = true

    void fetch(`/api/characters/${characterId}/view`, {
      method: "POST",
      keepalive: true,
    }).catch(() => {
      // View tracking is best-effort; never disrupt the page on failure.
    })
  }, [characterId])

  return null
}
