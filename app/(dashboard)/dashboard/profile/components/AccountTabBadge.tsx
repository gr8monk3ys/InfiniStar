"use client"

import { useCallback, useEffect, useState } from "react"

import { api } from "@/app/lib/api-client"

interface DeletionStatus {
  deletionRequested: boolean
  deletionRequestedAt: string | null
  deletionScheduledFor: string | null
  daysRemaining: number | null
}

/**
 * Lightweight badge shown on the "Delete Account" tab button when a
 * deletion request is pending.  Fetches its own data so page.tsx does not
 * need to know about deletion state.
 */
export function AccountTabBadge() {
  const [deletionRequested, setDeletionRequested] = useState(false)

  const fetch = useCallback(async () => {
    try {
      const response = await api.get<DeletionStatus>("/api/account/deletion-status", {
        showErrorToast: false,
      })
      setDeletionRequested(response.deletionRequested)
    } catch {
      // Ignore – badge simply stays hidden
    }
  }, [])

  useEffect(() => {
    fetch()
  }, [fetch])

  if (!deletionRequested) return null

  return (
    <span className="ml-1 rounded-full bg-yellow-500/10 px-2 py-0.5 text-xs text-yellow-800 dark:text-yellow-200">
      Pending
    </span>
  )
}
