"use client"

import { useCallback, useEffect, useState } from "react"
import dynamic from "next/dynamic"
import { useRouter } from "next/navigation"
import { useUser } from "@clerk/nextjs"
import type { CloudinaryUploadWidgetResults } from "next-cloudinary"
import toast from "react-hot-toast"
import {
  HiBell,
  HiClock,
  HiComputerDesktop,
  HiLockClosed,
  HiPaintBrush,
  HiShieldCheck,
  HiTrash,
  HiUser,
} from "react-icons/hi2"

import { api, ApiError, createLoadingToast } from "@/app/lib/api-client"
import { DarkModeToggle, ThemeCustomizer, ThemeSelector } from "@/app/components/themes"

import {
  AccountTabContent,
  NotificationsTabContent,
  PasswordTabContent,
  ProfileTabContent,
} from "./components"

// Lazy-load modals that are only shown on user interaction
const DeleteAccountModal = dynamic(() => import("@/app/components/modals/DeleteAccountModal"), {
  ssr: false,
  loading: () => null,
})

const StatusModal = dynamic(() => import("@/app/components/modals/StatusModal"), {
  ssr: false,
  loading: () => null,
})

// Dynamic imports for code splitting - only loaded when tab is active
const SessionsList = dynamic(() => import("@/app/components/SessionsList"), {
  loading: () => <div className="h-48 animate-pulse rounded-lg bg-gray-100" />,
  ssr: false,
})

const TwoFactorSettings = dynamic(
  () =>
    import("@/app/components/TwoFactorSettings").then((mod) => ({
      default: mod.TwoFactorSettings,
    })),
  {
    loading: () => <div className="h-48 animate-pulse rounded-lg bg-gray-100" />,
    ssr: false,
  }
)

const AutoDeleteSettings = dynamic(
  () => import("@/app/components/settings").then((mod) => ({ default: mod.AutoDeleteSettings })),
  {
    loading: () => <div className="h-48 animate-pulse rounded-lg bg-gray-100" />,
    ssr: false,
  }
)

// Deletion status type
interface DeletionStatus {
  deletionRequested: boolean
  deletionRequestedAt: string | null
  deletionScheduledFor: string | null
  daysRemaining: number | null
}

type TabType =
  | "profile"
  | "password"
  | "security"
  | "notifications"
  | "sessions"
  | "appearance"
  | "auto-delete"
  | "account"

export default function ProfilePage() {
  const { user, isLoaded } = useUser()
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<TabType>("profile")
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)

  // Profile form state
  const [name, setName] = useState("")
  const [bio, setBio] = useState("")
  const [location, setLocation] = useState("")
  const [website, setWebsite] = useState("")

  // Password form state
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")

  // Notification preferences state
  const [emailNotifications, setEmailNotifications] = useState(true)
  const [emailDigest, setEmailDigest] = useState<"none" | "daily" | "weekly">("none")
  const [browserNotifications, setBrowserNotifications] = useState(false)
  const [notifyOnNewMessage, setNotifyOnNewMessage] = useState(true)
  const [notifyOnMention, setNotifyOnMention] = useState(true)
  const [notifyOnAIComplete, setNotifyOnAIComplete] = useState(true)
  const [isNotificationsLoading, setIsNotificationsLoading] = useState(false)

  // Deletion status state
  const [deletionStatus, setDeletionStatus] = useState<DeletionStatus | null>(null)
  const [isDeletionLoading, setIsDeletionLoading] = useState(false)
  const [hasPassword, setHasPassword] = useState(false)

  // Fetch deletion status
  const fetchDeletionStatus = useCallback(async () => {
    try {
      const response = await api.get<DeletionStatus>("/api/account/deletion-status", {
        showErrorToast: false,
      })
      setDeletionStatus(response)
    } catch {
      // Ignore errors - user might not have access
    }
  }, [])

  // Check if user has password (credential account)
  const checkHasPassword = useCallback(async () => {
    try {
      const response = await api.get<{ hasPassword: boolean }>("/api/profile", {
        showErrorToast: false,
      })
      setHasPassword(response.hasPassword)
    } catch {
      setHasPassword(false)
    }
  }, [])

  // Fetch notification preferences
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
      }>("/api/notifications/preferences", {
        showErrorToast: false,
      })
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
    if (isLoaded && user) {
      setName(user.fullName || user.firstName || "")
      fetchDeletionStatus()
      checkHasPassword()
      fetchNotificationPreferences()
    }
  }, [isLoaded, user, fetchDeletionStatus, checkHasPassword, fetchNotificationPreferences])

  const handleAvatarUpload = async (result: CloudinaryUploadWidgetResults) => {
    if (!result.info || typeof result.info === "string" || !result.info.secure_url) {
      toast.error("Failed to upload image")
      return
    }

    const imageUrl = result.info.secure_url
    const loader = createLoadingToast("Uploading avatar...")

    try {
      await api.patch<{ message: string; user: { image: string } }>(
        "/api/profile",
        { image: imageUrl },
        { retries: 1, showErrorToast: false }
      )

      loader.success("Avatar updated successfully")

      // Reload Clerk user data to reflect the updated avatar
      await user?.reload()
    } catch (error) {
      const message = error instanceof ApiError ? error.message : "Failed to update avatar"
      loader.error(message)
    }
  }

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    const loader = createLoadingToast("Updating profile...")

    try {
      const response = await api.patch<{ message: string; user: { name: string } }>(
        "/api/profile",
        {
          name,
          bio: bio || null,
          location: location || null,
          website: website || null,
        },
        { retries: 1, showErrorToast: false }
      )

      loader.success(response.message)

      // Reload Clerk user data to reflect the updated name
      await user?.reload()
    } catch (error) {
      const message = error instanceof ApiError ? error.message : "Failed to update profile"
      loader.error(message)
    } finally {
      setIsLoading(false)
    }
  }

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (newPassword !== confirmPassword) {
      toast.error("New passwords do not match")
      return
    }

    if (newPassword.length < 8) {
      toast.error("Password must be at least 8 characters")
      return
    }

    setIsLoading(true)
    const loader = createLoadingToast("Changing password...")

    try {
      const response = await api.patch<{ message: string }>(
        "/api/profile",
        { currentPassword, newPassword },
        { retries: 1, showErrorToast: false }
      )

      loader.success(response.message)

      setCurrentPassword("")
      setNewPassword("")
      setConfirmPassword("")
    } catch (error) {
      const message = error instanceof ApiError ? error.message : "Failed to change password"
      loader.error(message)
    } finally {
      setIsLoading(false)
    }
  }

  const handleNotificationsSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsNotificationsLoading(true)

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
    } catch (error) {
      const message =
        error instanceof ApiError ? error.message : "Failed to save notification preferences"
      loader.error(message)
    } finally {
      setIsNotificationsLoading(false)
    }
  }

  const handleCancelDeletion = async () => {
    setIsDeletionLoading(true)
    const loader = createLoadingToast("Cancelling deletion request...")

    try {
      const response = await api.post<{ success: boolean; message: string }>(
        "/api/account/cancel-deletion",
        {},
        { showErrorToast: false }
      )

      loader.success(response.message)
      await fetchDeletionStatus()
    } catch (error) {
      const message =
        error instanceof ApiError ? error.message : "Failed to cancel deletion request"
      loader.error(message)
    } finally {
      setIsDeletionLoading(false)
    }
  }

  const tabs: { id: TabType; label: string; icon: React.ReactNode; isDestructive?: boolean }[] = [
    { id: "profile", label: "Profile Information", icon: <HiUser size={20} /> },
    { id: "password", label: "Change Password", icon: <HiLockClosed size={20} /> },
    { id: "security", label: "Security", icon: <HiShieldCheck size={20} /> },
    { id: "notifications", label: "Notifications", icon: <HiBell size={20} /> },
    { id: "sessions", label: "Sessions", icon: <HiComputerDesktop size={20} /> },
    { id: "appearance", label: "Appearance", icon: <HiPaintBrush size={20} /> },
    { id: "auto-delete", label: "Auto-Delete", icon: <HiClock size={20} /> },
    { id: "account", label: "Delete Account", icon: <HiTrash size={20} />, isDestructive: true },
  ]

  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      {/* Header */}
      <div className="border-b bg-white">
        <div className="mx-auto max-w-4xl px-4 py-6">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push("/dashboard")}
              className="text-gray-600 hover:text-gray-900"
              aria-label="Back to dashboard"
            >
              ← Back
            </button>
            <h1 className="text-2xl font-bold text-gray-900">Profile Settings</h1>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto w-full max-w-4xl px-4 py-8">
        <div className="rounded-lg bg-white shadow">
          {/* Tabs */}
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex gap-8 px-6" aria-label="Profile tabs">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 border-b-2 px-1 py-4 text-sm font-medium ${
                    activeTab === tab.id
                      ? tab.isDestructive
                        ? "border-red-500 text-red-600"
                        : "border-sky-500 text-sky-600"
                      : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
                  }`}
                >
                  {tab.icon}
                  {tab.label}
                  {tab.id === "account" && deletionStatus?.deletionRequested && (
                    <span className="ml-1 rounded-full bg-yellow-100 px-2 py-0.5 text-xs text-yellow-800">
                      Pending
                    </span>
                  )}
                </button>
              ))}
            </nav>
          </div>

          {/* Tab Content */}
          <div className="p-6">
            {activeTab === "profile" && (
              <ProfileTabContent
                user={
                  user
                    ? {
                        name: user.fullName || user.firstName || undefined,
                        email: user.emailAddresses[0]?.emailAddress,
                        image: user.imageUrl,
                      }
                    : undefined
                }
                name={name}
                setName={setName}
                bio={bio}
                setBio={setBio}
                location={location}
                setLocation={setLocation}
                website={website}
                setWebsite={setWebsite}
                isLoading={isLoading}
                onSubmit={handleProfileSubmit}
                onAvatarUpload={handleAvatarUpload}
                onOpenStatusModal={() => setIsStatusModalOpen(true)}
              />
            )}

            {activeTab === "password" && (
              <PasswordTabContent
                currentPassword={currentPassword}
                setCurrentPassword={setCurrentPassword}
                newPassword={newPassword}
                setNewPassword={setNewPassword}
                confirmPassword={confirmPassword}
                setConfirmPassword={setConfirmPassword}
                isLoading={isLoading}
                onSubmit={handlePasswordSubmit}
              />
            )}

            {activeTab === "security" && (
              <div className="space-y-6" aria-label="Security settings section">
                <div>
                  <h3 className="text-lg font-medium text-gray-900">Two-Factor Authentication</h3>
                  <p className="mt-1 text-sm text-gray-600">
                    Add an extra layer of security to your account by requiring a verification code
                    in addition to your password when signing in.
                  </p>
                </div>
                <TwoFactorSettings hasPassword={hasPassword} />
              </div>
            )}

            {activeTab === "notifications" && (
              <NotificationsTabContent
                emailNotifications={emailNotifications}
                setEmailNotifications={setEmailNotifications}
                emailDigest={emailDigest}
                setEmailDigest={setEmailDigest}
                browserNotifications={browserNotifications}
                setBrowserNotifications={setBrowserNotifications}
                notifyOnNewMessage={notifyOnNewMessage}
                setNotifyOnNewMessage={setNotifyOnNewMessage}
                notifyOnMention={notifyOnMention}
                setNotifyOnMention={setNotifyOnMention}
                notifyOnAIComplete={notifyOnAIComplete}
                setNotifyOnAIComplete={setNotifyOnAIComplete}
                isLoading={isNotificationsLoading}
                onSubmit={handleNotificationsSubmit}
              />
            )}

            {activeTab === "sessions" && (
              <div className="space-y-4" aria-label="Session management section">
                <div>
                  <h3 className="text-lg font-medium text-gray-900">Active Sessions</h3>
                  <p className="mt-1 text-sm text-gray-600">
                    Manage devices where you are currently logged in. Revoke access to any session
                    you do not recognize.
                  </p>
                </div>
                <SessionsList />
              </div>
            )}

            {activeTab === "appearance" && (
              <div className="space-y-8" aria-label="Appearance settings section">
                <div>
                  <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
                    Appearance
                  </h3>
                  <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                    Customize how InfiniStar looks. Choose a preset theme or create your own custom
                    appearance.
                  </p>
                </div>

                <section>
                  <h4 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    Color Mode
                  </h4>
                  <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
                    <DarkModeToggle />
                  </div>
                </section>

                <div className="border-t border-gray-200 dark:border-gray-700" />
                <ThemeSelector />
                <div className="border-t border-gray-200 dark:border-gray-700" />
                <ThemeCustomizer />
              </div>
            )}

            {activeTab === "auto-delete" && (
              <div className="space-y-4" aria-label="Auto-delete settings section">
                <AutoDeleteSettings />
              </div>
            )}

            {activeTab === "account" && (
              <AccountTabContent
                deletionStatus={deletionStatus}
                isDeletionLoading={isDeletionLoading}
                onCancelDeletion={handleCancelDeletion}
                onOpenDeleteModal={() => setIsDeleteModalOpen(true)}
              />
            )}
          </div>
        </div>
      </div>

      {isStatusModalOpen && (
        <StatusModal isOpen={isStatusModalOpen} onClose={() => setIsStatusModalOpen(false)} />
      )}
      {isDeleteModalOpen && (
        <DeleteAccountModal
          isOpen={isDeleteModalOpen}
          onClose={() => {
            setIsDeleteModalOpen(false)
            fetchDeletionStatus()
          }}
          hasPassword={hasPassword}
        />
      )}
    </div>
  )
}
