"use client"

import dynamic from "next/dynamic"
import Image from "next/image"
import type { CloudinaryUploadWidgetResults } from "next-cloudinary"
import { HiCamera, HiChatBubbleLeftRight, HiGlobeAlt } from "react-icons/hi2"

// Dynamic import to avoid build-time Cloudinary validation
const CldUploadButton = dynamic(
  () => import("next-cloudinary").then((mod) => mod.CldUploadButton),
  { ssr: false }
)

interface UserData {
  name?: string | null
  email?: string | null
  image?: string | null
  customStatus?: string | null
  customStatusEmoji?: string | null
}

interface ProfileTabContentProps {
  user: UserData | undefined
  name: string
  setName: (value: string) => void
  bio: string
  setBio: (value: string) => void
  location: string
  setLocation: (value: string) => void
  website: string
  setWebsite: (value: string) => void
  isLoading: boolean
  onSubmit: (e: React.FormEvent) => void
  onAvatarUpload: (result: CloudinaryUploadWidgetResults) => void
  onOpenStatusModal: () => void
}

export function ProfileTabContent({
  user,
  name,
  setName,
  bio,
  setBio,
  location,
  setLocation,
  website,
  setWebsite,
  isLoading,
  onSubmit,
  onAvatarUpload,
  onOpenStatusModal,
}: ProfileTabContentProps) {
  return (
    <form onSubmit={onSubmit} className="space-y-6" aria-label="Profile information form">
      {/* Avatar */}
      <div className="flex items-center gap-4">
        <div className="relative size-20 overflow-hidden rounded-full bg-muted">
          {user?.image ? (
            <Image
              src={user.image}
              alt={`${user.name ?? "User"}'s profile picture`}
              fill
              className="object-cover"
            />
          ) : (
            <div className="flex size-full items-center justify-center text-2xl font-semibold text-muted-foreground">
              {user?.name?.charAt(0).toUpperCase() || "U"}
            </div>
          )}
        </div>
        <div className="flex flex-col gap-2">
          <div>
            <p className="text-sm font-medium text-foreground">{user?.name}</p>
            <p className="text-sm text-muted-foreground">{user?.email}</p>
            {(user?.customStatus || user?.customStatusEmoji) && (
              <p className="mt-1 text-sm text-muted-foreground">
                {user.customStatusEmoji && <span className="mr-1">{user.customStatusEmoji}</span>}
                {user.customStatus}
              </p>
            )}
          </div>
          <div className="flex gap-2">
            <CldUploadButton
              options={{ maxFiles: 1, cropping: true, croppingAspectRatio: 1 }}
              onUpload={onAvatarUpload}
              uploadPreset="pgc9ehd5"
              className="flex items-center gap-2 rounded-md bg-muted px-3 py-2 text-sm font-medium text-foreground transition hover:bg-muted/80"
            >
              <HiCamera size={16} />
              Change Avatar
            </CldUploadButton>
            <button
              type="button"
              onClick={onOpenStatusModal}
              className="flex items-center gap-2 rounded-md bg-muted px-3 py-2 text-sm font-medium text-foreground transition hover:bg-muted/80"
            >
              <HiChatBubbleLeftRight size={16} />
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
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          disabled={isLoading}
          className="mt-1 block w-full rounded-md border border-border bg-background px-3 py-2 text-foreground shadow-sm focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:bg-muted"
          placeholder="Your name"
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
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          disabled={isLoading}
          rows={4}
          className="mt-1 block w-full rounded-md border border-border bg-background px-3 py-2 text-foreground shadow-sm focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:bg-muted"
          placeholder="Tell us about yourself..."
          maxLength={500}
        />
        <p className="mt-1 text-sm text-muted-foreground">{bio.length}/500 characters</p>
      </div>

      {/* Location */}
      <div>
        <label htmlFor="location" className="block text-sm font-medium text-foreground">
          Location
        </label>
        <input
          id="location"
          type="text"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          disabled={isLoading}
          className="mt-1 block w-full rounded-md border border-border bg-background px-3 py-2 text-foreground shadow-sm focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:bg-muted"
          placeholder="e.g., San Francisco, CA"
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
            type="url"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            disabled={isLoading}
            className="block w-full rounded-md border border-border bg-background py-2 pl-10 pr-3 text-foreground shadow-sm focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:bg-muted"
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
          className="rounded-md bg-primary px-4 py-2 text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isLoading ? "Saving..." : "Save Changes"}
        </button>
      </div>
    </form>
  )
}
