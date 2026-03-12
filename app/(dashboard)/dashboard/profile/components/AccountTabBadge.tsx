/**
 * Lightweight badge shown on the "Delete Account" tab button when a
 * deletion request is pending.
 */
export function AccountTabBadge({ deletionRequested }: { deletionRequested: boolean }) {
  if (!deletionRequested) return null

  return (
    <span className="ml-1 rounded-full bg-yellow-500/10 px-2 py-0.5 text-xs text-yellow-800 dark:text-yellow-200">
      Pending
    </span>
  )
}
