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

/**
 * Get session token from localStorage
 */
function getStoredSessionToken(): string | null {
  if (typeof window === "undefined") return null
  return localStorage.getItem(SESSION_TOKEN_KEY)
}

/**
 * Store session token in localStorage
 */
function storeSessionToken(token: string): void {
  if (typeof window === "undefined") return
  localStorage.setItem(SESSION_TOKEN_KEY, token)
}

/**
 * Remove session token from localStorage
 */
function removeSessionToken(): void {
  if (typeof window === "undefined") return
  localStorage.removeItem(SESSION_TOKEN_KEY)
}

/**
 * Format relative time for display
 */
function formatRelativeTime(date: Date): string {
  const now = new Date()
  const diff = now.getTime() - new Date(date).getTime()

  const seconds = Math.floor(diff / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (seconds < 60) {
    return "Just now"
  } else if (minutes < 60) {
    return `${minutes} minute${minutes === 1 ? "" : "s"} ago`
  } else if (hours < 24) {
    return `${hours} hour${hours === 1 ? "" : "s"} ago`
  } else if (days < 7) {
    return `${days} day${days === 1 ? "" : "s"} ago`
  } else {
    return new Date(date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    })
  }
}

/**
 * Get device icon based on device type
 */
function DeviceIcon({ deviceType }: { deviceType: string | null }) {
  const iconClass = "size-6 text-gray-500"

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
      <div
        className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-4"
        role="listitem"
      >
        <div className="flex items-start gap-4">
          <div className="mt-1 flex size-12 items-center justify-center rounded-full bg-gray-100">
            <DeviceIcon deviceType={session.deviceType} />
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="font-medium text-gray-900">
                {session.browser || "Unknown browser"}
              </span>
              {session.isCurrentSession && (
                <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                  <HiShieldCheck className="size-3" aria-hidden="true" />
                  Current session
                </span>
              )}
            </div>
            <span className="text-sm text-gray-600">{session.os || "Unknown OS"}</span>
            <div className="mt-1 flex items-center gap-3 text-xs text-gray-500">
              <span>IP: {session.ipAddress}</span>
              <span aria-label={`Last active ${formatRelativeTime(session.lastActiveAt)}`}>
                Active {formatRelativeTime(session.lastActiveAt)}
              </span>
            </div>
          </div>
        </div>

        {!session.isCurrentSession && (
          <button
            onClick={() => setShowConfirmDialog(true)}
            disabled={isRevoking}
            className="rounded-md border border-red-200 bg-white px-3 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
            aria-label={`Revoke session from ${session.browser || "Unknown browser"} on ${
              session.os || "Unknown OS"
            }`}
          >
            Revoke
          </button>
        )}
      </div>

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
            <div className="mt-3 rounded-md bg-gray-100 p-3 text-sm text-gray-700">
              <strong>Device:</strong> {session.browser || "Unknown"} on {session.os || "Unknown"}
              <br />
              <strong>IP Address:</strong> {session.ipAddress}
            </div>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRevoke}
              className="bg-red-600 text-white hover:bg-red-700"
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
  const [, setSessionToken] = useState<string | null>(null)

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
      setSessionToken(response.sessionToken)
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
      const message = error instanceof ApiError ? error.message : "Failed to load sessions"
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
    const loader = createLoadingToast("Revoking session...")

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
      const message = error instanceof ApiError ? error.message : "Failed to revoke session"
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
    const loader = createLoadingToast("Revoking all other sessions...")

    try {
      const token = getStoredSessionToken()

      if (!token) {
        loader.error("No current session found")
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
      const message = error instanceof ApiError ? error.message : "Failed to revoke other sessions"
      loader.error(message)
    } finally {
      setIsRevoking(false)
    }
  }, [])

  // Load sessions on mount
  useEffect(() => {
    fetchSessions()
  }, [fetchSessions])

  // Get count of other sessions
  const otherSessionsCount = sessions.filter((s) => !s.isCurrentSession).length

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="size-8 animate-spin rounded-full border-4 border-gray-300 border-t-sky-600" />
        <span className="sr-only">Loading sessions...</span>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header with action */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-600">
            {sessions.length} active session{sessions.length !== 1 ? "s" : ""}
          </p>
        </div>
        {otherSessionsCount > 0 && (
          <button
            onClick={() => setShowRevokeAllDialog(true)}
            disabled={isRevoking}
            className="flex items-center gap-2 rounded-md border border-red-200 bg-white px-3 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <HiTrash className="size-4" aria-hidden="true" />
            Revoke all other sessions
          </button>
        )}
      </div>

      {/* Sessions list */}
      {sessions.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-8 text-center">
          <HiShieldCheck className="mx-auto size-12 text-gray-400" aria-hidden="true" />
          <p className="mt-2 text-gray-600">No active sessions found</p>
        </div>
      ) : (
        <div className="space-y-3" role="list" aria-label="Active sessions">
          {sessions.map((session) => (
            <SessionItem
              key={session.id}
              session={session}
              onRevoke={revokeSession}
              isRevoking={isRevoking}
            />
          ))}
        </div>
      )}

      {/* Security note */}
      <div className="flex items-start gap-2 rounded-lg bg-blue-50 p-4 text-sm text-blue-800">
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
            <div className="mt-3 text-sm font-medium text-gray-700">
              Your current session will not be affected.
            </div>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={revokeAllOtherSessions}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              Revoke All ({otherSessionsCount})
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
