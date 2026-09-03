"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Dialog } from "@headlessui/react"
import toast from "react-hot-toast"
import { HiExclamationTriangle, HiEye, HiEyeSlash } from "react-icons/hi2"

import { api, ApiError, createLoadingToast } from "@/app/lib/api-client"

import Modal from "./Modal"

interface DeleteAccountModalProps {
  isOpen: boolean
  onClose: () => void
  hasPassword: boolean // Whether user has a password (credential account)
}

const DeleteAccountModal: React.FC<DeleteAccountModalProps> = ({
  isOpen,
  onClose,
  hasPassword,
}) => {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [password, setPassword] = useState("")
  const [confirmationText, setConfirmationText] = useState("")
  const [showPassword, setShowPassword] = useState(false)

  const isConfirmationValid = confirmationText === "DELETE"
  const isPasswordValid = !hasPassword || password.length > 0

  const handleDelete = async () => {
    if (!isConfirmationValid) {
      toast.error('You must type "DELETE" to confirm')
      return
    }

    if (hasPassword && !password) {
      toast.error("Please enter your password")
      return
    }

    setIsLoading(true)
    const loader = createLoadingToast("Processing deletion request...")

    try {
      const response = await api.delete<{
        success: boolean
        message: string
        deletionScheduledFor: string
        gracePeriodDays: number
      }>("/api/account", {
        data: {
          password: hasPassword ? password : undefined,
          confirmationText,
        },
        showErrorToast: false,
      })

      const scheduledDate = new Date(response.deletionScheduledFor)
      const formattedDate = scheduledDate.toLocaleDateString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      })

      loader.success("Account deletion scheduled")

      // Clear form and close modal
      setPassword("")
      setConfirmationText("")
      onClose()

      // Show detailed notification
      toast(
        `Your account will be deleted on ${formattedDate}. ` +
          `You have ${response.gracePeriodDays} days to cancel this request.`,
        {
          duration: 8000,
          icon: "info",
        }
      )

      // Refresh the page to show updated status
      router.refresh()
    } catch (error) {
      const message =
        error instanceof ApiError ? error.message : "Failed to process deletion request"
      loader.error(message)
    } finally {
      setIsLoading(false)
    }
  }

  const handleClose = () => {
    if (!isLoading) {
      setPassword("")
      setConfirmationText("")
      onClose()
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose}>
      <div className="sm:flex sm:items-start">
        <div className="mx-auto flex size-12 shrink-0 items-center justify-center rounded-full bg-destructive/10 sm:mx-0 sm:size-10">
          <HiExclamationTriangle className="size-6 text-destructive" aria-hidden="true" />
        </div>
        <div className="mt-3 text-center sm:ml-4 sm:mt-0 sm:text-left">
          <Dialog.Title as="h3" className="text-lg font-semibold leading-6 text-foreground">
            Delete Account
          </Dialog.Title>
          <div className="mt-2">
            <p className="text-sm text-muted-foreground">
              Are you sure you want to delete your account? This action will:
            </p>
            <ul className="mt-3 list-inside list-disc space-y-1 text-sm text-muted-foreground">
              <li>Delete all your messages and conversations</li>
              <li>Remove you from all shared conversations</li>
              <li>Delete your profile and settings</li>
              <li>Cancel any active subscriptions</li>
            </ul>
            <div className="mt-4 rounded-md bg-yellow-50 p-3">
              <p className="text-sm text-yellow-800">
                <strong>30-Day Grace Period:</strong> Your account will be scheduled for deletion in
                30 days. During this time, you can log in and cancel the deletion request.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6 space-y-4">
        {/* Password input for credential users */}
        {hasPassword && (
          <div>
            <label htmlFor="delete-password" className="block text-sm font-medium text-foreground">
              Enter your password to confirm
            </label>
            <div className="relative mt-1">
              <input
                id="delete-password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading}
                className="block w-full rounded-md border border-input bg-background px-3 py-2 pr-10 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-muted"
                placeholder="Your current password"
                aria-required="true"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground/70 hover:text-muted-foreground"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <HiEyeSlash className="size-5" /> : <HiEye className="size-5" />}
              </button>
            </div>
          </div>
        )}

        {/* Confirmation text input */}
        <div>
          <label htmlFor="confirmation-text" className="block text-sm font-medium text-foreground">
            Type <span className="font-bold text-destructive">DELETE</span> to confirm
          </label>
          <input
            id="confirmation-text"
            type="text"
            value={confirmationText}
            onChange={(e) => setConfirmationText(e.target.value.toUpperCase())}
            disabled={isLoading}
            className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-muted"
            placeholder="DELETE"
            aria-required="true"
            autoComplete="off"
          />
        </div>
      </div>

      <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <button
          type="button"
          onClick={handleClose}
          disabled={isLoading}
          className="inline-flex w-full justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground shadow-sm hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleDelete}
          disabled={isLoading || !isConfirmationValid || !isPasswordValid}
          aria-busy={isLoading}
          className="inline-flex w-full justify-center rounded-md border border-transparent bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground shadow-sm hover:bg-destructive/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
        >
          {isLoading ? "Processing..." : "Delete Account"}
        </button>
      </div>
    </Modal>
  )
}

export default DeleteAccountModal
