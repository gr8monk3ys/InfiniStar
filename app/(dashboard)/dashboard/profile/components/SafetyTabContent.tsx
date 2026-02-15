"use client"

import { useMemo } from "react"

interface SafetyTabContentProps {
  isAdult: boolean
  setIsAdult: (value: boolean) => void
  nsfwEnabled: boolean
  setNsfwEnabled: (value: boolean) => void
  isLoading: boolean
  onSubmit: (e: React.FormEvent) => void
}

export function SafetyTabContent({
  isAdult,
  setIsAdult,
  nsfwEnabled,
  setNsfwEnabled,
  isLoading,
  onSubmit,
}: SafetyTabContentProps) {
  const nsfwDisabledReason = useMemo(() => {
    if (!isAdult) return "Confirm 18+ to enable NSFW content."
    return null
  }, [isAdult])

  return (
    <form onSubmit={onSubmit} className="space-y-6" aria-label="Safety and content settings form">
      <div>
        <h3 className="text-lg font-medium text-gray-900">Safety &amp; Content</h3>
        <p className="mt-1 text-sm text-gray-600">
          Control whether you can view and chat with NSFW (18+) characters.
        </p>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-4">
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
            className="mt-1 size-4 rounded border-gray-300 text-sky-600 focus:ring-sky-500 disabled:cursor-not-allowed"
          />
          <span className="flex-1">
            <span className="block text-sm font-medium text-gray-900">I confirm I am 18+</span>
            <span className="mt-1 block text-sm text-gray-600">
              Required to enable NSFW content. Turning this off will also disable NSFW.
            </span>
          </span>
        </label>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <label className="flex items-start gap-3">
          <input
            type="checkbox"
            checked={nsfwEnabled}
            onChange={(e) => setNsfwEnabled(e.target.checked)}
            disabled={isLoading || !isAdult}
            className="mt-1 size-4 rounded border-gray-300 text-sky-600 focus:ring-sky-500 disabled:cursor-not-allowed"
          />
          <span className="flex-1">
            <span className="block text-sm font-medium text-gray-900">Enable NSFW content</span>
            <span className="mt-1 block text-sm text-gray-600">
              Shows NSFW characters in Explore and allows starting chats with them.
            </span>
            {nsfwDisabledReason && (
              <span className="mt-2 block text-xs text-gray-500">{nsfwDisabledReason}</span>
            )}
          </span>
        </label>
      </div>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={isLoading}
          aria-busy={isLoading}
          className="rounded-md bg-sky-600 px-4 py-2 text-white hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isLoading ? "Saving..." : "Save Changes"}
        </button>
      </div>
    </form>
  )
}
