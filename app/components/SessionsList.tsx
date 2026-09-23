"use client"

import { useCallback, useEffect, useState } from "react"
import toast from "react-hot-toast"
import {
  HiComputerDesktop,
  HiDevicePhoneMobile,
  HiDeviceTablet,
  HiExclamationTriangle,
  HiQuestionMarkCircle,
  HiShieldCheck,
  HiTrash,
} from "react-icons/hi2"

import { api, ApiError, createLoadingToast } from "@/app/lib/api-client"
import { formatDate, formatRelative } from "@/app/lib/intl-format"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/app/components/ui/alert-dialog"
import type { UserSessionInfo } from "@/app/types"

// Session token storage key
const SESSION_TOKEN_KEY = "infinistar_session_token"

// localStorage throws in private mode, over quota, or when storage is
// blocked; every access is guarded so the list still loads without it.

/**
 * Get session token from localStorage
 */
function getStoredSessionToken(): string | null {
  if (typeof window === "undefined") return null
  try {
    return localStorage.getItem(SESSION_TOKEN_KEY)
  } catch {
    return null
  }
}

/**
 * Store session token in localStorage
 */
function storeSessionToken(token: string): void {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(SESSION_TOKEN_KEY, token)
  } catch {
    // Storage unavailable: the session is re-registered on the next load.
  }
}

/**
 * Remove session token from localStorage
 */
function removeSessionToken(): void {
  if (typeof window === "undefined") return
  try {
    localStorage.removeItem(SESSION_TOKEN_KEY)
  } catch {
    // Storage unavailable: nothing to remove.
  }
}

const WEEK_MS = 7 * 24 * 60 * 60 * 1000

/**
 * Locale-aware "3 hours ago" for the last week, a date after that
 */
function formatRelativeTime(date: Date | string): string {
  const time = new Date(date).getTime()
  if (Date.now() - time < WEEK_MS) {
    return formatRelative(time)
  }
  return formatDate(time)
}

/**
 * Get device icon based on device type
 */
function DeviceIcon({ deviceType }: { deviceType: string | null }) {
  const iconClass = "size-6 text-muted-foreground"

  switch (deviceType?.toLowerCase()) {
    case "desktop":
      return <HiComputerDesktop className={iconClass} aria-hidden="true" />
    case "mobile":
    case "smartphone":
      return <HiDevicePhoneMobile className={iconClass} aria-hidden="true" />
    case "tablet":
      return <HiDeviceTablet className={iconClass} aria-hidden="true" />
    default:
      return <HiQuestionMarkCircle className={iconClass} aria-hidden="true" />
  }
}

interface SessionItemProps {
  session: UserSessionInfo
  onRevoke: (sessionId: string) => void
  isRevoking: boolean
}

/**
 * Individual session item component
 */
function SessionItem({ session, onRevoke, isRevoking }: SessionItemProps) {
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)

  const handleRevoke = () => {
    setShowConfirmDialog(false)
    onRevoke(session.id)
  }

  return (
    <>
      <li
        className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card p-4"
        data-current-session={session.isCurrentSession ? "true" : undefined}
      >
        <div className="flex min-w-0 items-start gap-4">
          <div className="mt-1 flex size-12 shrink-0 items-center justify-center rounded-full bg-muted">
            <DeviceIcon deviceType={session.deviceType} />
          </div>
          <div className="flex min-w-0 flex-col">
            <div className="flex flex-wrap items-center gap-2">
              <span className="break-words font-medium text-foreground">
                {session.browser || "Unknown browser"}
              </span>
              {session.isCurrentSession && (
                <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                  <HiShieldCheck className="size-3" aria-hidden="true" />
                  Current Session
                </span>
              )}
            </div>
            <span className="break-words text-sm text-muted-foreground">
              {session.os || "Unknown OS"}
            </span>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 text-xs text-muted-foreground">
              <span className="tabular-nums" translate="no">
                IP: {session.ipAddress}
              </span>
              <span>Active {formatRelativeTime(session.lastActiveAt)}</span>
            </div>
          </div>
        </div>

        {!session.isCurrentSession && (
          <button
            type="button"
            onClick={() => setShowConfirmDialog(true)}
            disabled={isRevoking}
            className="rounded-md border border-destructive/30 bg-background px-3 py-2 text-sm font-medium text-destructive transition hover:bg-destructive/10 disabled:cursor-not-allowed disabled:opacity-50"
            aria-label={`Revoke session from ${session.browser || "Unknown browser"} on ${
              session.os || "Unknown OS"
            }`}
          >
            Revoke
          </button>
        )}
      </li>

      {/* Confirmation Dialog */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <HiExclamationTriangle className="size-5 text-amber-500" aria-hidden="true" />
              Revoke Session
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to revoke this session? The device will be signed out and will
              need to log in again to access the application.
            </AlertDialogDescription>
            <div className="mt-3 rounded-md bg-muted p-3 text-sm text-foreground">
              <strong>Device:</strong> {session.browser || "Unknown"} on {session.os || "Unknown"}
              <br />
              <strong>IP Address:</strong> {session.ipAddress}
            </div>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRevoke}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Revoke Session
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

/**
 * Sessions List Component
 *
 * Displays all active sessions for the current user with options to:
 * - View device/browser info for each session
 * - Identify the current session
 * - Revoke individual sessions
 * - Revoke all other sessions at once
 */
export default function SessionsList() {
  const [sessions, setSessions] = useState<UserSessionInfo[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isRevoking, setIsRevoking] = useState(false)
  const [showRevokeAllDialog, setShowRevokeAllDialog] = useState(false)

  /**
   * Register a new session (called on first load if no token exists)
   */
  const registerSession = useCallback(async () => {
    try {
      const response = await api.post<{ sessionToken: string; sessionId: string }>(
        "/api/sessions",
        {},
        { showErrorToast: false }
      )
      storeSessionToken(response.sessionToken)
      return response.sessionToken
    } catch (error) {
      console.error("Failed to register session:", error)
      return null
    }
  }, [])

  /**
   * Fetch all active sessions
   */
  const fetchSessions = useCallback(async () => {
    setIsLoading(true)
    try {
      let token = getStoredSessionToken()

      // If no token exists, register a new session first
      if (!token) {
        token = await registerSession()
      }

      const response = await api.get<{ sessions: UserSessionInfo[] }>("/api/sessions", {
        headers: token ? { "X-Session-Token": token } : {},
        showErrorToast: false,
      })
      setSessions(response.sessions)
    } catch (error) {
      const message =
        error instanceof ApiError
          ? error.message
          : "Couldn't load your sessions. Check your connection and try again."
      toast.error(message)
    } finally {
      setIsLoading(false)
    }
  }, [registerSession])

  /**
   * Revoke a specific session
   */
  const revokeSession = useCallback(async (sessionId: string) => {
    setIsRevoking(true)
    const loader = createLoadingToast("Revoking session…")

    try {
      const token = getStoredSessionToken()
      const response = await api.delete<{ message: string; isCurrentSession: boolean }>(
        `/api/sessions/${sessionId}`,
        {
          headers: token ? { "X-Session-Token": token } : {},
          showErrorToast: false,
        }
      )

      loader.success(response.message)

      // If current session was revoked, clear token and reload
      if (response.isCurrentSession) {
        removeSessionToken()
        window.location.reload()
        return
      }

      // Remove from local state
      setSessions((prev) => prev.filter((s) => s.id !== sessionId))
    } catch (error) {
      const message =
        error instanceof ApiError
          ? error.message
          : "Couldn't revoke that session. Check your connection and try again."
      loader.error(message)
    } finally {
      setIsRevoking(false)
    }
  }, [])

  /**
   * Revoke all other sessions
   */
  const revokeAllOtherSessions = useCallback(async () => {
    setShowRevokeAllDialog(false)
    setIsRevoking(true)
    const loader = createLoadingToast("Revoking all other sessions…")

    try {
      const token = getStoredSessionToken()

      if (!token) {
        loader.error("Couldn't identify this device's session. Reload the page and try again.")
        return
      }

      const response = await api.delete<{ message: string; revokedCount: number }>(
        "/api/sessions",
        {
          headers: { "X-Session-Token": token },
          showErrorToast: false,
        }
      )

      loader.success(response.message)

      // Keep only current session in local state
      setSessions((prev) => prev.filter((s) => s.isCurrentSession))
    } catch (error) {
      const message =
        error instanceof ApiError
          ? error.message
          : "Couldn't revoke your other sessions. Check your connection and try again."
      loader.error(message)
    } finally {
      setIsRevoking(false)
    }
  }, [])

  // Load sessions on mount
  useEffect(() => {
    void fetchSessions()
  }, [fetchSessions])

  // Get count of other sessions
  const otherSessionsCount = sessions.filter((s) => !s.isCurrentSession).length

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="size-8 animate-spin rounded-full border-4 border-muted border-t-primary" />
        <span className="sr-only">Loading sessions…</span>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header with action */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm tabular-nums text-muted-foreground">
            {sessions.length} active session{sessions.length !== 1 ? "s" : ""}
          </p>
        </div>
        {otherSessionsCount > 0 && (
          <button
            type="button"
            onClick={() => setShowRevokeAllDialog(true)}
            disabled={isRevoking}
            className="flex items-center gap-2 rounded-md border border-destructive/30 bg-background px-3 py-2 text-sm font-medium text-destructive transition hover:bg-destructive/10 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <HiTrash className="size-4" aria-hidden="true" />
            Revoke All Other Sessions
          </button>
        )}
      </div>

      {/* Sessions list */}
      {sessions.length === 0 ? (
        <div className="rounded-lg border border-border bg-muted/50 p-8 text-center">
          <HiShieldCheck className="mx-auto size-12 text-muted-foreground/70" aria-hidden="true" />
          <p className="mt-2 text-muted-foreground">No active sessions found</p>
        </div>
      ) : (
        <ul className="space-y-3" aria-label="Active sessions">
          {sessions.map((session) => (
            <SessionItem
              key={session.id}
              session={session}
              onRevoke={revokeSession}
              isRevoking={isRevoking}
            />
          ))}
        </ul>
      )}

      {/* Security note */}
      <div className="flex items-start gap-2 rounded-lg bg-primary/10 p-4 text-sm text-primary-accent">
        <HiShieldCheck className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
        <div>
          <strong>Security tip:</strong> If you see any sessions you do not recognize, revoke them
          immediately and consider changing your password.
        </div>
      </div>

      {/* Revoke All Confirmation Dialog */}
      <AlertDialog open={showRevokeAllDialog} onOpenChange={setShowRevokeAllDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <HiExclamationTriangle className="size-5 text-amber-500" aria-hidden="true" />
              Revoke All Other Sessions
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to revoke all other sessions? This will sign out{" "}
              {otherSessionsCount} device{otherSessionsCount !== 1 ? "s" : ""} and they will need to
              log in again.
            </AlertDialogDescription>
            <div className="mt-3 text-sm font-medium text-foreground">
              Your current session will not be affected.
            </div>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={revokeAllOtherSessions}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Revoke All ({otherSessionsCount})
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
