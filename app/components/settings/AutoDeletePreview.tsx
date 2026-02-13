"use client"

import { Fragment } from "react"
import { Dialog, Transition } from "@headlessui/react"
import { format } from "date-fns"
import {
  HiArchiveBox,
  HiChatBubbleLeftRight,
  HiCpuChip,
  HiExclamationTriangle,
  HiXMark,
} from "react-icons/hi2"

interface ConversationPreview {
  id: string
  name: string | null
  isAI: boolean
  lastMessageAt: Date | string
  messageCount: number
  isArchived: boolean
  tags: { id: string; name: string; color: string }[]
  daysSinceLastMessage: number
}

interface AutoDeletePreviewProps {
  isOpen: boolean
  onClose: () => void
  conversations: ConversationPreview[]
  totalCount: number
  retentionDays: number
  onConfirmDelete: () => void
  isDeleting: boolean
}

export function AutoDeletePreview({
  isOpen,
  onClose,
  conversations,
  totalCount,
  retentionDays,
  onConfirmDelete,
  isDeleting,
}: AutoDeletePreviewProps) {
  const handleClose = () => {
    if (!isDeleting) {
      onClose()
    }
  }

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={handleClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/25" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-2xl overflow-hidden rounded-2xl bg-white p-6 text-left align-middle shadow-xl transition-all">
                {/* Header */}
                <div className="flex items-start justify-between">
                  <div>
                    <Dialog.Title as="h3" className="text-lg font-semibold leading-6 text-gray-900">
                      Auto-Delete Preview
                    </Dialog.Title>
                    <p className="mt-1 text-sm text-gray-500">
                      The following conversations will be deleted based on your settings.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleClose}
                    disabled={isDeleting}
                    className="rounded-md text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-sky-500 disabled:cursor-not-allowed disabled:opacity-50"
                    aria-label="Close preview"
                  >
                    <HiXMark className="size-6" />
                  </button>
                </div>

                {/* Summary */}
                <div className="mt-4 rounded-lg border border-yellow-200 bg-yellow-50 p-4">
                  <div className="flex items-center gap-2">
                    <HiExclamationTriangle className="size-5 text-yellow-600" />
                    <span className="text-sm font-medium text-yellow-800">
                      {totalCount === 0
                        ? "No conversations match the deletion criteria"
                        : totalCount === 1
                          ? "1 conversation will be deleted"
                          : `${totalCount} conversations will be deleted`}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-yellow-700">
                    Conversations older than {retentionDays} days without activity will be
                    permanently deleted.
                  </p>
                </div>

                {/* Conversation List */}
                {conversations.length > 0 && (
                  <div className="mt-4 max-h-80 overflow-y-auto">
                    <div className="space-y-2">
                      {conversations.map((conversation) => (
                        <div
                          key={conversation.id}
                          className="flex items-center justify-between rounded-lg border border-gray-200 p-3"
                        >
                          <div className="flex items-center gap-3">
                            <div className="flex size-10 items-center justify-center rounded-full bg-gray-100">
                              {conversation.isAI ? (
                                <HiCpuChip className="size-5 text-purple-600" />
                              ) : (
                                <HiChatBubbleLeftRight className="size-5 text-sky-600" />
                              )}
                            </div>
                            <div>
                              <p className="text-sm font-medium text-gray-900">
                                {conversation.name || "Untitled Conversation"}
                              </p>
                              <div className="flex items-center gap-2 text-xs text-gray-500">
                                <span>
                                  {conversation.messageCount}{" "}
                                  {conversation.messageCount === 1 ? "message" : "messages"}
                                </span>
                                <span>-</span>
                                <span>
                                  Last active{" "}
                                  {format(new Date(conversation.lastMessageAt), "MMM d, yyyy")}
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {conversation.isArchived && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-1 text-xs text-gray-600">
                                <HiArchiveBox className="size-3" />
                                Archived
                              </span>
                            )}
                            {conversation.tags.length > 0 && (
                              <div className="flex gap-1">
                                {conversation.tags.slice(0, 2).map((tag) => (
                                  <span
                                    key={tag.id}
                                    className="inline-flex rounded-full px-2 py-1 text-xs"
                                    style={{
                                      backgroundColor: `var(--tag-${tag.color}-bg, #f3f4f6)`,
                                      color: `var(--tag-${tag.color}-text, #374151)`,
                                    }}
                                  >
                                    {tag.name}
                                  </span>
                                ))}
                                {conversation.tags.length > 2 && (
                                  <span className="inline-flex rounded-full bg-gray-100 px-2 py-1 text-xs text-gray-600">
                                    +{conversation.tags.length - 2}
                                  </span>
                                )}
                              </div>
                            )}
                            <span className="text-xs text-gray-400">
                              {conversation.daysSinceLastMessage}d ago
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Empty State */}
                {conversations.length === 0 && (
                  <div className="mt-4 rounded-lg border-2 border-dashed border-gray-200 p-8 text-center">
                    <HiChatBubbleLeftRight className="mx-auto size-12 text-gray-300" />
                    <p className="mt-2 text-sm text-gray-500">
                      No conversations match your auto-delete criteria.
                    </p>
                    <p className="mt-1 text-xs text-gray-400">
                      All your conversations are within the retention period or excluded by tags.
                    </p>
                  </div>
                )}

                {/* Actions */}
                <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                  <button
                    type="button"
                    onClick={handleClose}
                    disabled={isDeleting}
                    className="inline-flex w-full justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
                  >
                    Close
                  </button>
                  {totalCount > 0 && (
                    <button
                      type="button"
                      onClick={onConfirmDelete}
                      disabled={isDeleting}
                      aria-busy={isDeleting}
                      className="inline-flex w-full justify-center rounded-md border border-transparent bg-red-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
                    >
                      {isDeleting
                        ? "Deleting..."
                        : `Delete ${totalCount} Conversation${totalCount === 1 ? "" : "s"}`}
                    </button>
                  )}
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  )
}

export default AutoDeletePreview
