"use client"

import { useState } from "react"
import axios from "axios"
import toast from "react-hot-toast"
import { HiOutlineXMark } from "react-icons/hi2"

import Modal from "@/app/components/ui/modal"
import { useCsrfToken } from "@/app/hooks/useCsrfToken"

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
  const { token: csrfToken } = useCsrfToken()
  // Status is persisted to the Prisma `User` row via PATCH /api/users/presence
  // (see handleSubmit). The form opens empty; pre-filling from the user's stored
  // status would require passing it in as a prop or fetching it on open.
  const [customStatus, setCustomStatus] = useState("")
  const [customStatusEmoji, setCustomStatusEmoji] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    if (!csrfToken) {
      toast.error("Security token not available. Please refresh the page.")
      setIsLoading(false)
      return
    }

    try {
      await axios.patch(
        "/api/users/presence",
        {
          status: "online",
          customStatus: customStatus || null,
          customStatusEmoji: customStatusEmoji || null,
        },
        {
          headers: { "X-CSRF-Token": csrfToken },
        }
      )

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

    if (!csrfToken) {
      toast.error("Security token not available. Please refresh the page.")
      setIsLoading(false)
      return
    }

    try {
      await axios.patch(
        "/api/users/presence",
        {
          status: "online",
          customStatus: null,
          customStatusEmoji: null,
        },
        {
          headers: { "X-CSRF-Token": csrfToken },
        }
      )

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
          <div className="flex items-center justify-between border-b border-border pb-4">
            <h3 className="text-lg font-medium leading-6 text-foreground">Set your status</h3>
            <button
              type="button"
              onClick={onClose}
              className="rounded-md text-muted-foreground transition hover:text-foreground focus:outline-none"
            >
              <HiOutlineXMark size={24} />
            </button>
          </div>

          <div className="space-y-4">
            {/* Emoji Picker */}
            <div>
              <label className="mb-2 block text-sm font-medium text-foreground">
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
                        ? "bg-primary/10 ring-2 ring-primary"
                        : "bg-muted hover:bg-muted/70"
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
                  className="mt-2 text-sm text-muted-foreground transition hover:text-foreground"
                >
                  Clear emoji
                </button>
              )}
            </div>

            {/* Status Text */}
            <div>
              <label htmlFor="status" className="block text-sm font-medium text-foreground">
                What&apos;s your status?
              </label>
              <input
                id="status"
                type="text"
                value={customStatus}
                onChange={(e) => setCustomStatus(e.target.value)}
                disabled={isLoading}
                className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-foreground shadow-sm focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:bg-muted"
                placeholder="e.g., In a meeting, Working from home, On vacation..."
                maxLength={100}
              />
              <p className="mt-1 text-sm text-muted-foreground">
                {customStatus.length}/100 characters
              </p>
            </div>

            {/* Preview */}
            {(customStatus || customStatusEmoji) && (
              <div className="rounded-md bg-muted p-3">
                <p className="mb-1 text-sm font-medium text-muted-foreground">Preview:</p>
                <p className="text-foreground">
                  {customStatusEmoji && <span className="mr-2">{customStatusEmoji}</span>}
                  {customStatus || "No status message"}
                </p>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between gap-3 border-t border-border pt-4">
            <button
              type="button"
              onClick={handleClearStatus}
              disabled={isLoading || (!customStatus && !customStatusEmoji)}
              className="rounded-md px-4 py-2 text-sm font-medium text-foreground transition hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
            >
              Clear status
            </button>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                disabled={isLoading}
                className="rounded-md px-4 py-2 text-sm font-medium text-foreground transition hover:bg-accent disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isLoading || (!customStatus && !customStatusEmoji)}
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
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
