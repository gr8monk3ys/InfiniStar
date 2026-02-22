"use client"

import { useCallback, useEffect, useState } from "react"
import toast from "react-hot-toast"

import { api, ApiError, createLoadingToast } from "@/app/lib/api-client"

// ---------------------------------------------------------------------------
// Push helpers (previously lived in page.tsx)
// ---------------------------------------------------------------------------

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/")
  const rawData = window.atob(base64)
  const buffer = new ArrayBuffer(rawData.length)
  const outputArray = new Uint8Array(buffer)
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

async function syncBackgroundPushForDevice(enabled: boolean) {
  if (typeof window === "undefined") return
  if (!("Notification" in window)) return
  if (!("serviceWorker" in navigator)) return
  if (!("PushManager" in window)) return

  if (!enabled) {
    const reg = await navigator.serviceWorker.getRegistration()
    if (!reg) return

    const sub = await reg.pushManager.getSubscription()
    if (!sub) return

    const endpoint = sub.endpoint
    await sub.unsubscribe().catch(() => {
      // best-effort
    })

    await api.delete("/api/notifications/push", {
      data: { endpoint },
      showErrorToast: false,
      retries: 0,
    })

    return
  }

  if (Notification.permission !== "granted") {
    const permission = await Notification.requestPermission()
    if (permission !== "granted") {
      return
    }
  }

  const status = await api.get<{ configured: boolean; publicKey: string | null }>(
    "/api/notifications/push",
    { showErrorToast: false, retries: 0 }
  )

  if (!status.configured || !status.publicKey) {
    return
  }

  const reg = await navigator.serviceWorker.register("/sw.js")
  const existingSub = await reg.pushManager.getSubscription()
  const subscription =
    existingSub ??
    (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(status.publicKey),
    }))

  await api.post(
    "/api/notifications/push",
    { subscription: subscription.toJSON(), userAgent: navigator.userAgent },
    { showErrorToast: false, retries: 0 }
  )
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function NotificationsTabContent() {
  const [isLoading, setIsLoading] = useState(false)

  const [emailNotifications, setEmailNotifications] = useState(true)
  const [emailDigest, setEmailDigest] = useState<"none" | "daily" | "weekly">("none")
  const [browserNotifications, setBrowserNotifications] = useState(false)
  const [notifyOnNewMessage, setNotifyOnNewMessage] = useState(true)
  const [notifyOnMention, setNotifyOnMention] = useState(true)
  const [notifyOnAIComplete, setNotifyOnAIComplete] = useState(true)

  const [pushSupported, setPushSupported] = useState(false)
  const [pushConfigured, setPushConfigured] = useState<boolean | null>(null)
  const [pushSubscribed, setPushSubscribed] = useState<boolean | null>(null)
  const [pushStatusLoading, setPushStatusLoading] = useState(false)
  const [pushTestLoading, setPushTestLoading] = useState(false)

  const fetchNotificationPreferences = useCallback(async () => {
    try {
      const response = await api.get<{
        preferences: {
          emailNotifications: boolean
          emailDigest: "none" | "daily" | "weekly"
          browserNotifications: boolean
          notifyOnNewMessage: boolean
          notifyOnMention: boolean
          notifyOnAIComplete: boolean
          mutedConversations: string[]
        }
      }>("/api/notifications/preferences", { showErrorToast: false })
      const prefs = response.preferences
      setEmailNotifications(prefs.emailNotifications)
      setEmailDigest(prefs.emailDigest)
      setBrowserNotifications(prefs.browserNotifications)
      setNotifyOnNewMessage(prefs.notifyOnNewMessage)
      setNotifyOnMention(prefs.notifyOnMention)
      setNotifyOnAIComplete(prefs.notifyOnAIComplete)
    } catch {
      // Use defaults if fetch fails
    }
  }, [])

  useEffect(() => {
    fetchNotificationPreferences()
  }, [fetchNotificationPreferences])

  useEffect(() => {
    let cancelled = false

    const checkPush = async () => {
      if (typeof window === "undefined") return

      const supported =
        "Notification" in window && "serviceWorker" in navigator && "PushManager" in window

      if (!cancelled) {
        setPushSupported(supported)
      }

      if (!supported) {
        if (!cancelled) {
          setPushConfigured(null)
          setPushSubscribed(null)
        }
        return
      }

      setPushStatusLoading(true)
      try {
        const status = await api.get<{ configured: boolean; publicKey: string | null }>(
          "/api/notifications/push",
          { showErrorToast: false, retries: 0 }
        )

        if (!cancelled) {
          setPushConfigured(Boolean(status.configured && status.publicKey))
        }

        let reg: ServiceWorkerRegistration | undefined =
          await navigator.serviceWorker.getRegistration()
        if (!reg && browserNotifications) {
          try {
            reg = await navigator.serviceWorker.register("/sw.js")
          } catch {
            reg = undefined
          }
        }

        const sub = reg ? await reg.pushManager.getSubscription() : null
        if (!cancelled) {
          setPushSubscribed(Boolean(sub))
        }
      } catch {
        if (!cancelled) {
          setPushConfigured(null)
          setPushSubscribed(null)
        }
      } finally {
        if (!cancelled) {
          setPushStatusLoading(false)
        }
      }
    }

    checkPush().catch(() => {
      // ignore
    })

    return () => {
      cancelled = true
    }
  }, [browserNotifications])

  const handleNotificationsSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    const loader = createLoadingToast("Saving notification preferences...")

    try {
      const response = await api.patch<{ message: string }>(
        "/api/notifications/preferences",
        {
          emailNotifications,
          emailDigest,
          browserNotifications,
          notifyOnNewMessage,
          notifyOnMention,
          notifyOnAIComplete,
        },
        { retries: 1, showErrorToast: false }
      )

      loader.success(response.message)

      // Best-effort: keep this device in sync with the saved preference.
      try {
        await syncBackgroundPushForDevice(browserNotifications)
      } catch {
        // Ignore push sync failures; prefs still saved.
      }
    } catch (error) {
      const message =
        error instanceof ApiError ? error.message : "Failed to save notification preferences"
      loader.error(message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <form
      onSubmit={handleNotificationsSubmit}
      className="space-y-6"
      aria-label="Notification preferences form"
    >
      <div>
        <h3 className="text-lg font-medium text-foreground">Notification Preferences</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Control how and when you receive notifications from InfiniStar.
        </p>
      </div>

      {/* Browser Notifications */}
      <div className="rounded-lg border border-border bg-muted p-4">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <label
              htmlFor="browserNotifications"
              className="block text-sm font-medium text-foreground"
            >
              Browser Notifications
            </label>
            <p className="mt-1 text-sm text-muted-foreground">
              Show notifications while this app is open (best-effort) and enable background push on
              supported browsers. You may need to grant permission in your browser.
            </p>
          </div>
          <button
            type="button"
            id="browserNotifications"
            role="switch"
            aria-checked={browserNotifications}
            onClick={async () => {
              if (isLoading) return

              if (browserNotifications) {
                setBrowserNotifications(false)
                return
              }

              if (typeof window === "undefined" || !("Notification" in window)) {
                toast.error("Browser notifications are not supported on this device.")
                return
              }

              const permission = await Notification.requestPermission()
              if (permission !== "granted") {
                toast.error("Notification permission not granted.")
                setBrowserNotifications(false)
                return
              }

              setBrowserNotifications(true)
            }}
            disabled={isLoading}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${
              browserNotifications ? "bg-primary" : "bg-input"
            }`}
          >
            <span className="sr-only">Enable browser notifications</span>
            <span
              className={`pointer-events-none inline-block size-5 rounded-full bg-background shadow ring-0 transition duration-200 ease-in-out ${
                browserNotifications ? "translate-x-5" : "translate-x-0"
              }`}
            />
          </button>
        </div>
      </div>

      {/* Background Push (Web Push) */}
      <div className="rounded-lg border border-border bg-muted p-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex-1">
            <h4 className="text-sm font-medium text-foreground">Background Push (Beta)</h4>
            <p className="mt-1 text-sm text-muted-foreground">
              Receive notifications even when the app is closed (requires service worker support).
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              Status:{" "}
              {pushStatusLoading
                ? "Checking..."
                : !pushSupported
                  ? "Not supported on this browser"
                  : pushConfigured === false
                    ? "Not configured on the server"
                    : browserNotifications
                      ? pushSubscribed
                        ? "Enabled on this device"
                        : "Not enabled on this device yet (save preferences to enable)"
                      : "Turn on Browser Notifications and save to enable"}
            </p>
          </div>

          <button
            type="button"
            disabled={
              isLoading ||
              pushTestLoading ||
              pushStatusLoading ||
              !pushSupported ||
              pushConfigured !== true ||
              !browserNotifications ||
              pushSubscribed !== true
            }
            onClick={async () => {
              if (pushTestLoading || isLoading) return
              setPushTestLoading(true)
              const loader = createLoadingToast("Sending test push...")
              try {
                await api.post(
                  "/api/notifications/push/test",
                  {},
                  { showErrorToast: false, retries: 0 }
                )
                loader.success("Test push sent (check your notifications).")
              } catch (error) {
                const message = error instanceof Error ? error.message : "Failed to send test push"
                loader.error(message)
              } finally {
                setPushTestLoading(false)
              }
            }}
            className="rounded-md bg-primary px-3 py-2 text-sm text-white hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pushTestLoading ? "Sending..." : "Send Test"}
          </button>
        </div>
      </div>

      {/* Email Notifications Master Toggle */}
      <div className="rounded-lg border border-border bg-muted p-4">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <label
              htmlFor="emailNotifications"
              className="block text-sm font-medium text-foreground"
            >
              Email Notifications
            </label>
            <p className="mt-1 text-sm text-muted-foreground">
              Receive email notifications for important updates and messages.
            </p>
          </div>
          <button
            type="button"
            id="emailNotifications"
            role="switch"
            aria-checked={emailNotifications}
            onClick={() => setEmailNotifications(!emailNotifications)}
            disabled={isLoading}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${
              emailNotifications ? "bg-primary" : "bg-input"
            }`}
          >
            <span className="sr-only">Enable email notifications</span>
            <span
              className={`pointer-events-none inline-block size-5 rounded-full bg-background shadow ring-0 transition duration-200 ease-in-out ${
                emailNotifications ? "translate-x-5" : "translate-x-0"
              }`}
            />
          </button>
        </div>
      </div>

      {/* Email Digest Frequency */}
      <div>
        <label htmlFor="emailDigest" className="block text-sm font-medium text-foreground">
          Email Digest Frequency
        </label>
        <p className="mt-1 text-sm text-muted-foreground">
          Receive a summary of your activity and conversations.
        </p>
        <select
          id="emailDigest"
          value={emailDigest}
          onChange={(e) => setEmailDigest(e.target.value as "none" | "daily" | "weekly")}
          disabled={isLoading || !emailNotifications}
          className="mt-2 block w-full rounded-md border border-border bg-background px-3 py-2 shadow-sm focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground"
        >
          <option value="none">No digest</option>
          <option value="daily">Daily summary</option>
          <option value="weekly">Weekly summary</option>
        </select>
      </div>

      {/* Notification Type Toggles */}
      <div className="space-y-4">
        <h4 className="text-sm font-medium text-foreground">Notification Types</h4>

        {/* New Message Notifications */}
        <div className="flex items-center justify-between rounded-lg border border-border p-4">
          <div className="flex-1">
            <label
              htmlFor="notifyOnNewMessage"
              className="block text-sm font-medium text-foreground"
            >
              New Messages
            </label>
            <p className="mt-1 text-sm text-muted-foreground">
              Get notified when you receive a new message in a conversation.
            </p>
          </div>
          <button
            type="button"
            id="notifyOnNewMessage"
            role="switch"
            aria-checked={notifyOnNewMessage}
            onClick={() => setNotifyOnNewMessage(!notifyOnNewMessage)}
            disabled={isLoading}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${
              notifyOnNewMessage ? "bg-primary" : "bg-input"
            }`}
          >
            <span className="sr-only">Enable new message notifications</span>
            <span
              className={`pointer-events-none inline-block size-5 rounded-full bg-background shadow ring-0 transition duration-200 ease-in-out ${
                notifyOnNewMessage ? "translate-x-5" : "translate-x-0"
              }`}
            />
          </button>
        </div>

        {/* Mention Notifications */}
        <div className="flex items-center justify-between rounded-lg border border-border p-4">
          <div className="flex-1">
            <label htmlFor="notifyOnMention" className="block text-sm font-medium text-foreground">
              Mentions
            </label>
            <p className="mt-1 text-sm text-muted-foreground">
              Get notified when someone mentions you in a conversation.
            </p>
          </div>
          <button
            type="button"
            id="notifyOnMention"
            role="switch"
            aria-checked={notifyOnMention}
            onClick={() => setNotifyOnMention(!notifyOnMention)}
            disabled={isLoading}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${
              notifyOnMention ? "bg-primary" : "bg-input"
            }`}
          >
            <span className="sr-only">Enable mention notifications</span>
            <span
              className={`pointer-events-none inline-block size-5 rounded-full bg-background shadow ring-0 transition duration-200 ease-in-out ${
                notifyOnMention ? "translate-x-5" : "translate-x-0"
              }`}
            />
          </button>
        </div>

        {/* AI Response Notifications */}
        <div className="flex items-center justify-between rounded-lg border border-border p-4">
          <div className="flex-1">
            <label
              htmlFor="notifyOnAIComplete"
              className="block text-sm font-medium text-foreground"
            >
              AI Response Complete
            </label>
            <p className="mt-1 text-sm text-muted-foreground">
              Get notified when an AI assistant has finished generating a response.
            </p>
          </div>
          <button
            type="button"
            id="notifyOnAIComplete"
            role="switch"
            aria-checked={notifyOnAIComplete}
            onClick={() => setNotifyOnAIComplete(!notifyOnAIComplete)}
            disabled={isLoading}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${
              notifyOnAIComplete ? "bg-primary" : "bg-input"
            }`}
          >
            <span className="sr-only">Enable AI response notifications</span>
            <span
              className={`pointer-events-none inline-block size-5 rounded-full bg-background shadow ring-0 transition duration-200 ease-in-out ${
                notifyOnAIComplete ? "translate-x-5" : "translate-x-0"
              }`}
            />
          </button>
        </div>
      </div>

      {/* Muted Conversations Info */}
      <div className="rounded-lg border border-border bg-muted p-4">
        <h4 className="text-sm font-medium text-foreground">Muted Conversations</h4>
        <p className="mt-1 text-sm text-muted-foreground">
          You can mute individual conversations to stop receiving notifications from them. To mute a
          conversation, open it and click the mute button in the conversation settings.
        </p>
      </div>

      {/* Submit Button */}
      <div className="flex justify-end">
        <button
          type="submit"
          disabled={isLoading}
          aria-busy={isLoading}
          className="rounded-md bg-primary px-4 py-2 text-white hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isLoading ? "Saving..." : "Save Preferences"}
        </button>
      </div>
    </form>
  )
}
