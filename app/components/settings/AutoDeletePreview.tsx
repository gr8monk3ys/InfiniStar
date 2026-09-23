"use client"

import { Fragment } from "react"
import { Dialog, Transition } from "@headlessui/react"
import {
  HiArchiveBox,
  HiChatBubbleLeftRight,
  HiCpuChip,
  HiExclamationTriangle,
  HiXMark,
} from "react-icons/hi2"

import { formatDate, formatRelative } from "@/app/lib/intl-format"

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

        <div className="fixed inset-0 overflow-y-auto overscroll-contain">
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
              <Dialog.Panel className="w-full max-w-2xl overflow-hidden rounded-2xl bg-card p-6 text-left align-middle shadow-xl transition">
                {/* Header */}
                <div className="flex items-start justify-between">
                  <div>
                    <Dialog.Title
                      as="h3"
                      className="text-lg font-semibold leading-6 text-foreground"
                    >
                      Auto-Delete Preview
                    </Dialog.Title>
                    <p className="mt-1 text-sm text-muted-foreground">
                      The following conversations will be deleted based on your settings.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleClose}
                    disabled={isDeleting}
                    className="rounded-md text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                    aria-label="Close preview"
                  >
                    <HiXMark className="size-6" aria-hidden="true" />
                  </button>
                </div>

                {/* Summary */}
                <div className="mt-4 rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-4">
                  <div className="flex items-center gap-2">
                    <HiExclamationTriangle
                      className="size-5 shrink-0 text-yellow-600 dark:text-yellow-400"
                      aria-hidden="true"
                    />
                    <span className="text-sm font-medium tabular-nums text-yellow-800 dark:text-yellow-200">
                      {totalCount === 0
                        ? "No conversations match the deletion criteria"
                        : totalCount === 1
                          ? "1 conversation will be deleted"
                          : `${totalCount} conversations will be deleted`}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-yellow-700 dark:text-yellow-300">
                    Conversations older than {retentionDays} days without activity will be
                    permanently deleted.
                  </p>
                </div>

                {/* Conversation List */}
                {conversations.length > 0 && (
                  <div className="mt-4 max-h-80 overflow-y-auto overscroll-contain">
                    <ul className="space-y-2">
                      {conversations.map((conversation) => (
                        <li
                          key={conversation.id}
                          className="flex items-center justify-between gap-3 rounded-lg border border-border p-3 [contain-intrinsic-size:auto_66px] [content-visibility:auto]"
                        >
                          <div className="flex min-w-0 items-center gap-3">
                            <div
                              className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted"
                              aria-hidden="true"
                            >
                              {conversation.isAI ? (
                                <HiCpuChip className="size-5 text-primary" />
                              ) : (
                                <HiChatBubbleLeftRight className="size-5 text-primary" />
                              )}
                            </div>
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium text-foreground">
                                {conversation.name || "Untitled Conversation"}
                              </p>
                              <div className="flex items-center gap-2 text-xs tabular-nums text-muted-foreground">
                                <span>
                                  {conversation.messageCount}{" "}
                                  {conversation.messageCount === 1 ? "message" : "messages"}
                                </span>
                                <span aria-hidden="true">·</span>
                                <span>Last active {formatDate(conversation.lastMessageAt)}</span>
                              </div>
                            </div>
                          </div>
                          <div className="flex shrink-0 items-center gap-2">
                            {conversation.isArchived && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-1 text-xs text-muted-foreground">
                                <HiArchiveBox className="size-3" aria-hidden="true" />
                                Archived
                              </span>
                            )}
                            {conversation.tags.length > 0 && (
                              <div className="flex gap-1">
                                {conversation.tags.slice(0, 2).map((tag) => (
                                  <span
                                    key={tag.id}
                                    className="inline-flex max-w-24 truncate rounded-full px-2 py-1 text-xs"
                                    style={{
                                      backgroundColor: `var(--tag-${tag.color}-bg, hsl(var(--muted)))`,
                                      color: `var(--tag-${tag.color}-text, hsl(var(--muted-foreground)))`,
                                    }}
                                  >
                                    {tag.name}
                                  </span>
                                ))}
                                {conversation.tags.length > 2 && (
                                  <span className="inline-flex rounded-full bg-muted px-2 py-1 text-xs tabular-nums text-muted-foreground">
                                    +{conversation.tags.length - 2}
                                  </span>
                                )}
                              </div>
                            )}
                            <span className="text-xs text-muted-foreground">
                              {formatRelative(conversation.lastMessageAt)}
                            </span>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Empty State */}
                {conversations.length === 0 && (
                  <div className="mt-4 rounded-lg border-2 border-dashed border-border p-8 text-center">
                    <HiChatBubbleLeftRight
                      className="mx-auto size-12 text-muted-foreground/30"
                      aria-hidden="true"
                    />
                    <p className="mt-2 text-sm text-muted-foreground">
                      No conversations match your auto-delete criteria.
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground/70">
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
                    className="inline-flex w-full justify-center rounded-md border border-border bg-card px-4 py-2 text-sm font-medium text-foreground shadow-sm hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
                  >
                    Close
                  </button>
                  {totalCount > 0 && (
                    <button
                      type="button"
                      onClick={onConfirmDelete}
                      disabled={isDeleting}
                      aria-busy={isDeleting}
                      className="inline-flex w-full justify-center rounded-md border border-transparent bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground shadow-sm hover:bg-destructive/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
                    >
                      {isDeleting
                        ? "Deleting…"
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
