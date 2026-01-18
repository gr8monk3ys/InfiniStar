"use client"

import { useEffect, useState } from "react"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { CldUploadButton, type CloudinaryUploadWidgetResults } from "next-cloudinary"
import toast from "react-hot-toast"
import { HiCamera, HiChatBubbleLeftRight, HiGlobeAlt, HiLockClosed, HiUser } from "react-icons/hi2"

import { ApiError, api, createLoadingToast } from "@/app/lib/api-client"
import StatusModal from "@/app/components/modals/StatusModal"

export default function ProfilePage() {
  const { data: session, update } = useSession()
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<"profile" | "password">("profile")
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false)

  // Profile form state
  const [name, setName] = useState("")
  const [bio, setBio] = useState("")
  const [location, setLocation] = useState("")
  const [website, setWebsite] = useState("")

  // Password form state
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")

  useEffect(() => {
    if (session?.user) {
      setName(session.user.name || "")
    }
  }, [session])

  const handleAvatarUpload = async (result: CloudinaryUploadWidgetResults) => {
    if (!result.info || typeof result.info === "string" || !result.info.secure_url) {
      toast.error("Failed to upload image")
      return
    }

    const imageUrl = result.info.secure_url
    const loader = createLoadingToast("Uploading avatar...")

    try {
      const response = await api.patch<{ message: string; user: { image: string } }>(
        "/api/profile",
        {
          image: imageUrl,
        },
        {
          retries: 1,
          showErrorToast: false,
        }
      )

      loader.success("Avatar updated successfully")

      // Update session with new image
      await update({
        ...session,
        user: {
          ...session?.user,
          image: response.user.image,
        },
      })
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
        {
          retries: 1,
          showErrorToast: false,
        }
      )

      loader.success(response.message)

      // Update session with new user data
      await update({
        ...session,
        user: {
          ...session?.user,
          name: response.user.name,
        },
      })
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
        {
          currentPassword,
          newPassword,
        },
        {
          retries: 1,
          showErrorToast: false,
        }
      )

      loader.success(response.message)

      // Clear password fields
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
              <button
                onClick={() => setActiveTab("profile")}
                className={`flex items-center gap-2 border-b-2 px-1 py-4 text-sm font-medium ${
                  activeTab === "profile"
                    ? "border-sky-500 text-sky-600"
                    : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
                }`}
              >
                <HiUser size={20} />
                Profile Information
              </button>
              <button
                onClick={() => setActiveTab("password")}
                className={`flex items-center gap-2 border-b-2 px-1 py-4 text-sm font-medium ${
                  activeTab === "password"
                    ? "border-sky-500 text-sky-600"
                    : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
                }`}
              >
                <HiLockClosed size={20} />
                Change Password
              </button>
            </nav>
          </div>

          {/* Tab Content */}
          <div className="p-6">
            {activeTab === "profile" ? (
              <form
                onSubmit={handleProfileSubmit}
                className="space-y-6"
                aria-label="Profile information form"
              >
                {/* Avatar */}
                <div className="flex items-center gap-4">
                  <div className="relative size-20 overflow-hidden rounded-full bg-gray-200">
                    {session?.user?.image ? (
                      <Image
                        src={session.user.image}
                        alt={`${session.user.name}'s profile picture`}
                        fill
                        className="object-cover"
                      />
                    ) : (
                      <div className="flex size-full items-center justify-center text-2xl font-semibold text-gray-500">
                        {session?.user?.name?.charAt(0).toUpperCase() || "U"}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col gap-2">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{session?.user?.name}</p>
                      <p className="text-sm text-gray-500">{session?.user?.email}</p>
                      {(session?.user?.customStatus || session?.user?.customStatusEmoji) && (
                        <p className="mt-1 text-sm text-gray-600">
                          {session.user.customStatusEmoji && (
                            <span className="mr-1">{session.user.customStatusEmoji}</span>
                          )}
                          {session.user.customStatus}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <CldUploadButton
                        options={{ maxFiles: 1, cropping: true, croppingAspectRatio: 1 }}
                        onUpload={handleAvatarUpload}
                        uploadPreset="pgc9ehd5"
                        className="flex items-center gap-2 rounded-md bg-gray-100 px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-200"
                      >
                        <HiCamera size={16} />
                        Change Avatar
                      </CldUploadButton>
                      <button
                        type="button"
                        onClick={() => setIsStatusModalOpen(true)}
                        className="flex items-center gap-2 rounded-md bg-gray-100 px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-200"
                      >
                        <HiChatBubbleLeftRight size={16} />
                        Set Status
                      </button>
                    </div>
                  </div>
                </div>

                {/* Name */}
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                    Display Name
                  </label>
                  <input
                    id="name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    disabled={isLoading}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500 disabled:cursor-not-allowed disabled:bg-gray-100"
                    placeholder="Your name"
                    maxLength={100}
                  />
                </div>

                {/* Bio */}
                <div>
                  <label htmlFor="bio" className="block text-sm font-medium text-gray-700">
                    Bio
                  </label>
                  <textarea
                    id="bio"
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    disabled={isLoading}
                    rows={4}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500 disabled:cursor-not-allowed disabled:bg-gray-100"
                    placeholder="Tell us about yourself..."
                    maxLength={500}
                  />
                  <p className="mt-1 text-sm text-gray-500">{bio.length}/500 characters</p>
                </div>

                {/* Location */}
                <div>
                  <label htmlFor="location" className="block text-sm font-medium text-gray-700">
                    Location
                  </label>
                  <input
                    id="location"
                    type="text"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    disabled={isLoading}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500 disabled:cursor-not-allowed disabled:bg-gray-100"
                    placeholder="e.g., San Francisco, CA"
                    maxLength={100}
                  />
                </div>

                {/* Website */}
                <div>
                  <label htmlFor="website" className="block text-sm font-medium text-gray-700">
                    Website
                  </label>
                  <div className="relative mt-1">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                      <HiGlobeAlt className="size-5 text-gray-400" aria-hidden="true" />
                    </div>
                    <input
                      id="website"
                      type="url"
                      value={website}
                      onChange={(e) => setWebsite(e.target.value)}
                      disabled={isLoading}
                      className="block w-full rounded-md border border-gray-300 py-2 pl-10 pr-3 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500 disabled:cursor-not-allowed disabled:bg-gray-100"
                      placeholder="https://yourwebsite.com"
                      maxLength={200}
                    />
                  </div>
                </div>

                {/* Submit Button */}
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
            ) : (
              <form
                onSubmit={handlePasswordSubmit}
                className="space-y-6"
                aria-label="Change password form"
              >
                <p className="text-sm text-gray-600">
                  Choose a strong password to keep your account secure.
                </p>

                {/* Current Password */}
                <div>
                  <label
                    htmlFor="currentPassword"
                    className="block text-sm font-medium text-gray-700"
                  >
                    Current Password
                  </label>
                  <input
                    id="currentPassword"
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    required
                    disabled={isLoading}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500 disabled:cursor-not-allowed disabled:bg-gray-100"
                    placeholder="Enter current password"
                    aria-required="true"
                  />
                </div>

                {/* New Password */}
                <div>
                  <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700">
                    New Password
                  </label>
                  <input
                    id="newPassword"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    disabled={isLoading}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500 disabled:cursor-not-allowed disabled:bg-gray-100"
                    placeholder="Enter new password"
                    minLength={8}
                    aria-required="true"
                    aria-describedby="password-hint"
                  />
                  <p id="password-hint" className="mt-1 text-sm text-gray-500">
                    Must be at least 8 characters
                  </p>
                </div>

                {/* Confirm Password */}
                <div>
                  <label
                    htmlFor="confirmPassword"
                    className="block text-sm font-medium text-gray-700"
                  >
                    Confirm New Password
                  </label>
                  <input
                    id="confirmPassword"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    disabled={isLoading}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500 disabled:cursor-not-allowed disabled:bg-gray-100"
                    placeholder="Confirm new password"
                    minLength={8}
                    aria-required="true"
                  />
                </div>

                {/* Submit Button */}
                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={isLoading}
                    aria-busy={isLoading}
                    className="rounded-md bg-sky-600 px-4 py-2 text-white hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isLoading ? "Changing..." : "Change Password"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
      <StatusModal isOpen={isStatusModalOpen} onClose={() => setIsStatusModalOpen(false)} />
    </div>
  )
}
