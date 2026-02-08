"use client"

import { useState } from "react"
import { useUser } from "@clerk/nextjs"
import axios from "axios"
import toast from "react-hot-toast"
import { HiOutlineXMark } from "react-icons/hi2"

import Modal from "@/app/components/ui/modal"

interface StatusModalProps {
  isOpen: boolean
  onClose: () => void
}

const COMMON_EMOJIS = [
  "😀",
  "😎",
  "🎉",
  "💼",
  "☕",
  "🌟",
  "🔥",
  "💪",
  "🎯",
  "✨",
  "🚀",
  "💻",
  "🎨",
  "🎵",
  "🏖️",
  "🌈",
]

const StatusModal: React.FC<StatusModalProps> = ({ isOpen, onClose }) => {
  const { user } = useUser()
  // TODO: customStatus and customStatusEmoji are not stored in Clerk.
  // These should be fetched from the Prisma user object instead of the session.
  const [customStatus, setCustomStatus] = useState("")
  const [customStatusEmoji, setCustomStatusEmoji] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      // Update presence with custom status
      await axios.patch("/api/users/presence", {
        status: "online",
        customStatus: customStatus || null,
        customStatusEmoji: customStatusEmoji || null,
      })

      // TODO: Clerk's useUser() has no update method for custom fields.
      // Custom status is persisted via the API call above; consider using
      // a local state store or refetching from the Prisma user object.

      toast.success("Status updated successfully")
      onClose()
    } catch (error: unknown) {
      const axiosError = error as { response?: { data?: { error?: string } } }
      toast.error(axiosError.response?.data?.error || "Failed to update status")
    } finally {
      setIsLoading(false)
    }
  }

  const handleClearStatus = async () => {
    setIsLoading(true)

    try {
      await axios.patch("/api/users/presence", {
        status: "online",
        customStatus: null,
        customStatusEmoji: null,
      })

      // TODO: Clerk's useUser() has no update method for custom fields.
      // Custom status is persisted via the API call above; consider using
      // a local state store or refetching from the Prisma user object.

      setCustomStatus("")
      setCustomStatusEmoji("")
      toast.success("Status cleared")
      onClose()
    } catch (error: unknown) {
      const axiosError = error as { response?: { data?: { error?: string } } }
      toast.error(axiosError.response?.data?.error || "Failed to clear status")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <div className="space-y-6">
          <div className="flex items-center justify-between border-b border-gray-200 pb-4">
            <h3 className="text-lg font-medium leading-6 text-gray-900">Set your status</h3>
            <button
              type="button"
              onClick={onClose}
              className="rounded-md text-gray-400 hover:text-gray-500 focus:outline-none"
            >
              <HiOutlineXMark size={24} />
            </button>
          </div>

          <div className="space-y-4">
            {/* Emoji Picker */}
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Choose an emoji
              </label>
              <div className="grid grid-cols-8 gap-2">
                {COMMON_EMOJIS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => setCustomStatusEmoji(emoji)}
                    className={`flex items-center justify-center rounded-md p-2 text-2xl transition ${
                      customStatusEmoji === emoji
                        ? "bg-sky-100 ring-2 ring-sky-500"
                        : "bg-gray-100 hover:bg-gray-200"
                    }`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
              {customStatusEmoji && (
                <button
                  type="button"
                  onClick={() => setCustomStatusEmoji("")}
                  className="mt-2 text-sm text-gray-600 hover:text-gray-800"
                >
                  Clear emoji
                </button>
              )}
            </div>

            {/* Status Text */}
            <div>
              <label htmlFor="status" className="block text-sm font-medium text-gray-700">
                What&apos;s your status?
              </label>
              <input
                id="status"
                type="text"
                value={customStatus}
                onChange={(e) => setCustomStatus(e.target.value)}
                disabled={isLoading}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500 disabled:cursor-not-allowed disabled:bg-gray-100"
                placeholder="e.g., In a meeting, Working from home, On vacation..."
                maxLength={100}
              />
              <p className="mt-1 text-sm text-gray-500">{customStatus.length}/100 characters</p>
            </div>

            {/* Preview */}
            {(customStatus || customStatusEmoji) && (
              <div className="rounded-md bg-gray-50 p-3">
                <p className="mb-1 text-sm font-medium text-gray-700">Preview:</p>
                <p className="text-gray-900">
                  {customStatusEmoji && <span className="mr-2">{customStatusEmoji}</span>}
                  {customStatus || "No status message"}
                </p>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between gap-3 border-t border-gray-200 pt-4">
            <button
              type="button"
              onClick={handleClearStatus}
              disabled={isLoading || (!customStatus && !customStatusEmoji)}
              className="rounded-md px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Clear status
            </button>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                disabled={isLoading}
                className="rounded-md px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isLoading || (!customStatus && !customStatusEmoji)}
                className="rounded-md bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isLoading ? "Saving..." : "Save status"}
              </button>
            </div>
          </div>
        </div>
      </form>
    </Modal>
  )
}

export default StatusModal
