"use client"

import { useCallback, useEffect, useState } from "react"
import dynamic from "next/dynamic"
import Image from "next/image"
import type { CloudinaryUploadWidgetResults } from "next-cloudinary"
import { HiCamera, HiChatBubbleLeftRight, HiGlobeAlt } from "react-icons/hi2"

import { api, ApiError, createLoadingToast } from "@/app/lib/api-client"
import { useAppAuth } from "@/app/hooks/useAppAuth"

import { useUnsavedChangesGuard } from "../../hooks/useUnsavedChangesGuard"

// Dynamic imports to avoid build-time Cloudinary validation and defer modal
const CldUploadButton = dynamic(
  () => import("next-cloudinary").then((mod) => mod.CldUploadButton),
  { ssr: false }
)

const StatusModal = dynamic(() => import("@/app/components/modals/StatusModal"), {
  ssr: false,
  loading: () => null,
})

const cloudinaryUploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET
const hasCloudinaryConfig = Boolean(
  process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME && cloudinaryUploadPreset
)

export function ProfileTabContent() {
  const { user, isLoaded, refresh } = useAppAuth()
  const [isLoading, setIsLoading] = useState(false)
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false)

  const [name, setName] = useState("")
  const [bio, setBio] = useState("")
  const [location, setLocation] = useState("")
  const [website, setWebsite] = useState("")
  // Last values the server accepted for the fields that are not read back from it.
  const [saved, setSaved] = useState({ bio: "", location: "", website: "" })

  const userName = user?.name
  useEffect(() => {
    if (isLoaded && userName !== undefined) {
      setName(userName || "")
    }
  }, [isLoaded, userName])

  const isDirty =
    (isLoaded && user ? name !== (user.name || "") : false) ||
    bio !== saved.bio ||
    location !== saved.location ||
    website !== saved.website
  useUnsavedChangesGuard(isDirty && !isLoading)

  const handleAvatarUpload = useCallback(
    async (result: CloudinaryUploadWidgetResults) => {
      if (!result.info || typeof result.info === "string" || !result.info.secure_url) {
        const { default: toast } = await import("react-hot-toast")
        toast.error("Couldn't upload your image. Try again.")
        return
      }

      const imageUrl = result.info.secure_url
      const loader = createLoadingToast("Uploading avatar…")

      try {
        await api.patch<{ message: string; user: { image: string } }>(
          "/api/profile",
          { image: imageUrl },
          { retries: 1, showErrorToast: false }
        )

        loader.success("Avatar updated successfully")
        await refresh()
      } catch (error) {
        const message =
          error instanceof ApiError ? error.message : "Couldn't update your avatar. Try again."
        loader.error(message)
      }
    },
    [refresh]
  )

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    const loader = createLoadingToast("Updating profile…")

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
      setSaved({ bio, location, website })
      await refresh()
    } catch (error) {
      const message =
        error instanceof ApiError
          ? error.message
          : "Couldn't update your profile. Check your connection and try again."
      loader.error(message)
    } finally {
      setIsLoading(false)
    }
  }

  const userData = user
    ? {
        name: user.name || undefined,
        email: user.email,
        image: user.image,
        customStatus: undefined as string | undefined,
        customStatusEmoji: undefined as string | undefined,
      }
    : undefined

  return (
    <>
      <form
        onSubmit={handleProfileSubmit}
        className="space-y-6"
        aria-label="Profile information form"
      >
        {/* Avatar */}
        <div className="flex items-center gap-4">
          <div className="relative size-20 overflow-hidden rounded-full bg-muted">
            {userData?.image ? (
              <Image
                src={userData.image}
                alt={`${userData.name ?? "User"}'s profile picture`}
                fill
                sizes="80px"
                className="object-cover"
              />
            ) : (
              <div className="flex size-full items-center justify-center text-2xl font-semibold text-muted-foreground">
                {userData?.name?.charAt(0).toUpperCase() || "U"}
              </div>
            )}
          </div>
          <div className="flex min-w-0 flex-col gap-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-foreground">{userData?.name}</p>
              <p className="truncate text-sm text-muted-foreground">{userData?.email}</p>
              {(userData?.customStatus || userData?.customStatusEmoji) && (
                <p className="mt-1 text-sm text-muted-foreground">
                  {userData.customStatusEmoji && (
                    <span className="mr-1">{userData.customStatusEmoji}</span>
                  )}
                  {userData.customStatus}
                </p>
              )}
            </div>
            <div className="flex gap-2">
              {hasCloudinaryConfig ? (
                <CldUploadButton
                  options={{ maxFiles: 1, cropping: true, croppingAspectRatio: 1 }}
                  onUpload={handleAvatarUpload}
                  uploadPreset={cloudinaryUploadPreset}
                  className="flex items-center gap-2 rounded-md bg-muted px-3 py-2 text-sm font-medium text-foreground transition hover:bg-muted/80"
                >
                  <HiCamera size={16} aria-hidden="true" />
                  Change Avatar
                </CldUploadButton>
              ) : (
                <button
                  type="button"
                  disabled
                  title="Avatar upload is unavailable until Cloudinary is configured."
                  className="flex cursor-not-allowed items-center gap-2 rounded-md bg-muted px-3 py-2 text-sm font-medium text-muted-foreground opacity-70"
                >
                  <HiCamera size={16} aria-hidden="true" />
                  Change Avatar
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsStatusModalOpen(true)}
                className="flex items-center gap-2 rounded-md bg-muted px-3 py-2 text-sm font-medium text-foreground transition hover:bg-muted/80"
              >
                <HiChatBubbleLeftRight size={16} aria-hidden="true" />
                Set Status
              </button>
            </div>
          </div>
        </div>

        {/* Name */}
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-foreground">
            Display Name
          </label>
          <input
            id="name"
            name="name"
            type="text"
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            disabled={isLoading}
            className="mt-1 block w-full rounded-md border border-border bg-background px-3 py-2 text-foreground shadow-sm focus-visible:border-ring focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:bg-muted"
            placeholder="Your name…"
            maxLength={100}
          />
        </div>

        {/* Bio */}
        <div>
          <label htmlFor="bio" className="block text-sm font-medium text-foreground">
            Bio
          </label>
          <textarea
            id="bio"
            name="bio"
            autoComplete="off"
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            disabled={isLoading}
            rows={4}
            className="mt-1 block w-full rounded-md border border-border bg-background px-3 py-2 text-foreground shadow-sm focus-visible:border-ring focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:bg-muted"
            placeholder="Tell us about yourself…"
            maxLength={500}
          />
          <p className="mt-1 text-sm tabular-nums text-muted-foreground">
            {bio.length}/500 characters
          </p>
        </div>

        {/* Location */}
        <div>
          <label htmlFor="location" className="block text-sm font-medium text-foreground">
            Location
          </label>
          <input
            id="location"
            name="location"
            type="text"
            autoComplete="off"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            disabled={isLoading}
            className="mt-1 block w-full rounded-md border border-border bg-background px-3 py-2 text-foreground shadow-sm focus-visible:border-ring focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:bg-muted"
            placeholder="San Francisco, CA…"
            maxLength={100}
          />
        </div>

        {/* Website */}
        <div>
          <label htmlFor="website" className="block text-sm font-medium text-foreground">
            Website
          </label>
          <div className="relative mt-1">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
              <HiGlobeAlt className="size-5 text-muted-foreground" aria-hidden="true" />
            </div>
            <input
              id="website"
              name="website"
              type="url"
              autoComplete="url"
              spellCheck={false}
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              disabled={isLoading}
              className="block w-full rounded-md border border-border bg-background py-2 pl-10 pr-3 text-foreground shadow-sm focus-visible:border-ring focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:bg-muted"
              placeholder="https://example.com…"
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
            className="rounded-md bg-primary px-4 py-2 text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isLoading ? "Saving…" : "Save Changes"}
          </button>
        </div>
      </form>

      {isStatusModalOpen && (
        <StatusModal isOpen={isStatusModalOpen} onClose={() => setIsStatusModalOpen(false)} />
      )}
    </>
  )
}
