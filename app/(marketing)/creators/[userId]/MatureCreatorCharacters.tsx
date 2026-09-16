"use client"

import { useEffect, useState } from "react"

import { useAppAuth } from "@/app/hooks/useAppAuth"

import { revealCreatorCharacters } from "./actions"

/**
 * Wraps the cached (SFW) character grid and swaps in the viewer's full grid,
 * mature characters included, once `/api/auth/session` confirms they may see
 * them. Anyone else keeps the grid the server already rendered.
 */
export function MatureCreatorCharacters({
  creatorId,
  children,
}: {
  creatorId: string
  children: React.ReactNode
}) {
  const { isLoaded, viewer } = useAppAuth()
  const [grid, setGrid] = useState<React.ReactNode>(null)

  const canView = isLoaded && viewer.canViewMature

  useEffect(() => {
    if (!canView) {
      return
    }

    let cancelled = false
    revealCreatorCharacters(creatorId)
      .then((result) => {
        if (!cancelled && result.status === "ok") {
          setGrid(result.grid)
        }
      })
      .catch(() => {
        // Keep the SFW grid.
      })

    return () => {
      cancelled = true
    }
  }, [canView, creatorId])

  return <>{grid ?? children}</>
}
