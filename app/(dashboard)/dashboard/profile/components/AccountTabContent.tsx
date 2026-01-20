"use client"

import { HiExclamationTriangle, HiTrash } from "react-icons/hi2"

interface DeletionStatus {
  deletionRequested: boolean
  deletionRequestedAt: string | null
  deletionScheduledFor: string | null
  daysRemaining: number | null
}

interface AccountTabContentProps {
  deletionStatus: DeletionStatus | null
  isDeletionLoading: boolean
  onCancelDeletion: () => void
  onOpenDeleteModal: () => void
}

export function AccountTabContent({
  deletionStatus,
  isDeletionLoading,
  onCancelDeletion,
  onOpenDeleteModal,
}: AccountTabContentProps) {
  return (
    <div className="space-y-6" aria-label="Account deletion section">
      {deletionStatus?.deletionRequested ? (
        /* Deletion Pending State */
        <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-6">
          <div className="flex items-start gap-4">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-yellow-100">
              <HiExclamationTriangle className="size-5 text-yellow-600" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-yellow-800">Account Deletion Pending</h3>
              <p className="mt-1 text-sm text-yellow-700">
                Your account is scheduled to be deleted on{" "}
                <strong>
                  {deletionStatus.deletionScheduledFor
                    ? new Date(deletionStatus.deletionScheduledFor).toLocaleDateString("en-US", {
                        weekday: "long",
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })
                    : "soon"}
                </strong>
                .
              </p>
              {deletionStatus.daysRemaining !== null && (
                <p className="mt-2 text-sm text-yellow-700">
                  You have <strong>{deletionStatus.daysRemaining} days</strong> remaining to cancel
                  this request.
                </p>
              )}
              <div className="mt-4">
                <button
                  onClick={onCancelDeletion}
                  disabled={isDeletionLoading}
                  aria-busy={isDeletionLoading}
                  className="inline-flex items-center rounded-md bg-yellow-600 px-4 py-2 text-sm font-medium text-white hover:bg-yellow-700 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isDeletionLoading ? "Cancelling..." : "Cancel Deletion Request"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Normal Delete Account State */
        <>
          <div className="rounded-lg border border-red-200 bg-red-50 p-6">
            <h3 className="text-lg font-semibold text-red-800">Danger Zone</h3>
            <p className="mt-2 text-sm text-gray-600">
              Once you delete your account, there is no going back. Please be certain.
            </p>
            <div className="mt-4 space-y-3">
              <p className="text-sm text-gray-600">
                <strong>What happens when you delete your account:</strong>
              </p>
              <ul className="list-inside list-disc space-y-1 text-sm text-gray-600">
                <li>All your messages will be permanently deleted</li>
                <li>You will be removed from all conversations</li>
                <li>Your profile and settings will be erased</li>
                <li>Any active subscriptions will be cancelled</li>
                <li>This action cannot be reversed after the grace period</li>
              </ul>
            </div>
            <div className="mt-4 rounded-md bg-yellow-100 p-3">
              <p className="text-sm text-yellow-800">
                <strong>30-Day Grace Period:</strong> After requesting deletion, you have 30 days to
                change your mind. During this time, you can log in and cancel the deletion request.
              </p>
            </div>
            <div className="mt-6">
              <button
                onClick={onOpenDeleteModal}
                className="inline-flex items-center gap-2 rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
              >
                <HiTrash size={16} />
                Delete My Account
              </button>
            </div>
          </div>

          <div className="rounded-lg border border-gray-200 bg-gray-50 p-6">
            <h3 className="text-base font-medium text-gray-900">Need help instead?</h3>
            <p className="mt-2 text-sm text-gray-600">
              If you are having issues with your account, our support team is here to help. You do
              not need to delete your account to resolve most problems.
            </p>
            <a
              href="mailto:support@example.com"
              className="mt-3 inline-block text-sm font-medium text-sky-600 hover:text-sky-700"
            >
              Contact Support
            </a>
          </div>
        </>
      )}
    </div>
  )
}
