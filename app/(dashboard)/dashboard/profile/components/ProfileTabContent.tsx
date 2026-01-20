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
        <div className="relative size-20 overflow-hidden rounded-full bg-gray-200">
          {user?.image ? (
            <Image
              src={user.image}
              alt={`${user.name}'s profile picture`}
              fill
              className="object-cover"
            />
          ) : (
            <div className="flex size-full items-center justify-center text-2xl font-semibold text-gray-500">
              {user?.name?.charAt(0).toUpperCase() || "U"}
            </div>
          )}
        </div>
        <div className="flex flex-col gap-2">
          <div>
            <p className="text-sm font-medium text-gray-900">{user?.name}</p>
            <p className="text-sm text-gray-500">{user?.email}</p>
            {(user?.customStatus || user?.customStatusEmoji) && (
              <p className="mt-1 text-sm text-gray-600">
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
              className="flex items-center gap-2 rounded-md bg-gray-100 px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-200"
            >
              <HiCamera size={16} />
              Change Avatar
            </CldUploadButton>
            <button
              type="button"
              onClick={onOpenStatusModal}
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
  )
}
