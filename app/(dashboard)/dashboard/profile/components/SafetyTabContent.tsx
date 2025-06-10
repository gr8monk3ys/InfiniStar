"use client"

import { useCallback, useEffect, useMemo, useState } from "react"

import { api, ApiError, createLoadingToast } from "@/app/lib/api-client"

export function SafetyTabContent() {
  const [isLoading, setIsLoading] = useState(false)
  const [isAdult, setIsAdult] = useState(false)
  const [nsfwEnabled, setNsfwEnabled] = useState(false)

  const fetchSafetyPreferences = useCallback(async () => {
    try {
      const response = await api.get<{
        preferences: {
          isAdult: boolean
          nsfwEnabled: boolean
        }
      }>("/api/safety/preferences", { showErrorToast: false })
      setIsAdult(response.preferences.isAdult)
      setNsfwEnabled(response.preferences.nsfwEnabled)
    } catch {
      // Defaults are fine
    }
  }, [])

  useEffect(() => {
    fetchSafetyPreferences()
  }, [fetchSafetyPreferences])

  const handleSafetySubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    const loader = createLoadingToast("Saving safety settings...")

    try {
      const response = await api.patch<{
        message: string
        preferences: {
          isAdult: boolean
          nsfwEnabled: boolean
        }
      }>("/api/safety/preferences", { isAdult, nsfwEnabled }, { retries: 1, showErrorToast: false })

      loader.success(response.message)
      setIsAdult(response.preferences.isAdult)
      setNsfwEnabled(response.preferences.nsfwEnabled)
    } catch (error) {
      const message = error instanceof ApiError ? error.message : "Failed to save safety settings"
      loader.error(message)
    } finally {
      setIsLoading(false)
    }
  }

  const nsfwDisabledReason = useMemo(() => {
    if (!isAdult) return "Confirm 18+ to enable NSFW content."
    return null
  }, [isAdult])

  return (
    <form
      onSubmit={handleSafetySubmit}
      className="space-y-6"
      aria-label="Safety and content settings form"
    >
      <div>
        <h3 className="text-lg font-medium text-foreground">Safety &amp; Content</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Control whether you can view and chat with NSFW (18+) characters.
        </p>
      </div>

      <div className="rounded-lg border border-border bg-muted p-4">
        <label className="flex items-start gap-3">
          <input
            type="checkbox"
            checked={isAdult}
            onChange={(e) => {
              const next = e.target.checked
              setIsAdult(next)
              if (!next) setNsfwEnabled(false)
            }}
            disabled={isLoading}
            className="mt-1 size-4 rounded border-border text-primary focus:ring-ring disabled:cursor-not-allowed"
          />
          <span className="flex-1">
            <span className="block text-sm font-medium text-foreground">I confirm I am 18+</span>
            <span className="mt-1 block text-sm text-muted-foreground">
              Required to enable NSFW content. Turning this off will also disable NSFW.
            </span>
          </span>
        </label>
      </div>

      <div className="rounded-lg border border-border bg-muted p-4">
        <label className="flex items-start gap-3">
          <input
            type="checkbox"
            checked={nsfwEnabled}
            onChange={(e) => setNsfwEnabled(e.target.checked)}
            disabled={isLoading || !isAdult}
            className="mt-1 size-4 rounded border-border text-primary focus:ring-ring disabled:cursor-not-allowed"
          />
          <span className="flex-1">
            <span className="block text-sm font-medium text-foreground">Enable NSFW content</span>
            <span className="mt-1 block text-sm text-muted-foreground">
              Shows NSFW characters in Explore and allows starting chats with them.
            </span>
            {nsfwDisabledReason && (
              <span className="mt-2 block text-xs text-muted-foreground">{nsfwDisabledReason}</span>
            )}
          </span>
        </label>
      </div>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={isLoading}
          aria-busy={isLoading}
          className="rounded-md bg-primary px-4 py-2 text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isLoading ? "Saving..." : "Save Changes"}
        </button>
      </div>
    </form>
  )
}
