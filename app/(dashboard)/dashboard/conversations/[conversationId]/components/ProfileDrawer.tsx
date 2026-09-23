"use client"

import { Fragment, memo, useState } from "react"
import { Dialog, Transition } from "@headlessui/react"
import toast from "react-hot-toast"
import { BsPinAngle, BsPinAngleFill } from "react-icons/bs"
import {
  HiArchiveBox,
  HiArchiveBoxXMark,
  HiOutlineBell,
  HiOutlineBellSlash,
  HiOutlineFlag,
  HiOutlineShieldExclamation,
} from "react-icons/hi2"
import { IoClose, IoTrash } from "react-icons/io5"

import { api, ApiError } from "@/app/lib/api-client"
import { formatDate } from "@/app/lib/intl-format"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/app/components/ui/alert-dialog"
import useActiveList from "@/app/(dashboard)/dashboard/hooks/useActiveList"
import useOtherUser from "@/app/(dashboard)/dashboard/hooks/useOtherUser"
import Avatar from "@/app/components/Avatar"
import AvatarGroup from "@/app/components/AvatarGroup"
import { useCsrfToken } from "@/app/hooks/useCsrfToken"
import { type FullConversationType } from "@/app/types"

import ConfirmModal from "./ConfirmModal"

interface ProfileDrawerProps {
  isOpen: boolean
  onClose: () => void
  data: FullConversationType
  currentUserId: string | null
}

/**
 * ProfileDrawer component - Displays conversation/user profile in a slide-out drawer
 *
 * Wrapped with React.memo to prevent unnecessary re-renders when parent re-renders
 * but the drawer props haven't changed.
 */
const ProfileDrawer: React.FC<ProfileDrawerProps> = memo(function ProfileDrawer({
  isOpen,
  onClose,
  data,
  currentUserId,
}) {
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [isArchiving, setIsArchiving] = useState(false)
  const [isPinning, setIsPinning] = useState(false)
  const [isMuting, setIsMuting] = useState(false)

  // Block dialog state
  const [showBlockDialog, setShowBlockDialog] = useState(false)
  const [blockReason, setBlockReason] = useState("")

  // Report dialog state
  const [showReportDialog, setShowReportDialog] = useState(false)
  const [reportReason, setReportReason] = useState("")

  const { token: csrfToken } = useCsrfToken()
  const otherUser = useOtherUser(data)

  // Locale-aware (Intl). This drawer is client-only (ssr: false), so there is
  // no server/client hydration difference to guard.
  const joinedAt = otherUser ? new Date(otherUser.createdAt) : null
  const joinedDate = joinedAt ? formatDate(joinedAt) : null

  // Cheap primitive expressions: computed inline rather than memoized.
  const title = data.title || otherUser?.name || "AI Character"

  // Subscribe only to this participant's presence, not the whole list.
  const otherUserId = otherUser?.id ?? ""
  const isActive = useActiveList((state) =>
    otherUserId ? state.members.includes(otherUserId) : false
  )
  const presence = useActiveList((state) =>
    otherUserId ? state.presenceMap.get(otherUserId) : undefined
  )

  let statusText: string
  if (data.isGroup) {
    statusText = `${data.users.length} members`
  } else if (presence?.customStatus) {
    // Show custom status if available
    statusText = `${presence.customStatusEmoji || ""} ${presence.customStatus}`.trim()
  } else {
    // Show presence status
    const presenceStatus = presence?.presenceStatus || (isActive ? "online" : "offline")
    statusText =
      presenceStatus === "online" ? "Active" : presenceStatus === "away" ? "Away" : "Offline"
  }

  const isArchived = currentUserId ? data.archivedBy?.includes(currentUserId) || false : false
  const isPinned = currentUserId ? data.pinnedBy?.includes(currentUserId) || false : false
  const isMuted = currentUserId ? data.mutedBy?.includes(currentUserId) || false : false

  const handleArchiveToggle = async () => {
    if (!csrfToken) {
      toast.error("Security token not available. Please refresh the page.")
      return
    }
    setIsArchiving(true)
    try {
      if (isArchived) {
        await api.delete(`/api/conversations/${data.id}/archive`, {
          headers: { "X-CSRF-Token": csrfToken },
        })
        toast.success("Conversation unarchived")
      } else {
        await api.post(`/api/conversations/${data.id}/archive`, undefined, {
          headers: { "X-CSRF-Token": csrfToken },
        })
        toast.success("Conversation archived")
      }
    } catch (error) {
      const message =
        error instanceof ApiError ? error.message : "Couldn't update the archive status. Try again."
      toast.error(message)
    } finally {
      setIsArchiving(false)
    }
  }

  const handlePinToggle = async () => {
    if (!csrfToken) {
      toast.error("Security token not available. Please refresh the page.")
      return
    }
    setIsPinning(true)
    try {
      if (isPinned) {
        await api.delete(`/api/conversations/${data.id}/pin`, {
          headers: { "X-CSRF-Token": csrfToken },
        })
        toast.success("Conversation unpinned")
      } else {
        await api.post(`/api/conversations/${data.id}/pin`, undefined, {
          headers: { "X-CSRF-Token": csrfToken },
        })
        toast.success("Conversation pinned")
      }
    } catch (error) {
      const message =
        error instanceof ApiError ? error.message : "Couldn't update the pin. Try again."
      toast.error(message)
    } finally {
      setIsPinning(false)
    }
  }

  const handleMuteToggle = async () => {
    if (!csrfToken) {
      toast.error("Security token not available. Please refresh the page.")
      return
    }
    setIsMuting(true)
    try {
      if (isMuted) {
        await api.delete(`/api/conversations/${data.id}/mute`, {
          headers: { "X-CSRF-Token": csrfToken },
        })
        toast.success("Conversation unmuted")
      } else {
        await api.post(`/api/conversations/${data.id}/mute`, undefined, {
          headers: { "X-CSRF-Token": csrfToken },
        })
        toast.success("Conversation muted")
      }
    } catch (error) {
      const message =
        error instanceof ApiError ? error.message : "Couldn't update the mute setting. Try again."
      toast.error(message)
    } finally {
      setIsMuting(false)
    }
  }

  const handleBlockConfirm = async () => {
    if (!otherUser?.id) return
    if (!csrfToken) {
      toast.error("Security token not available. Please refresh the page.")
      return
    }
    try {
      await api.post(
        "/api/moderation/blocks",
        {
          blockedUserId: otherUser.id,
          reason: blockReason.trim() || undefined,
        },
        { headers: { "X-CSRF-Token": csrfToken } }
      )
      toast.success("User blocked")
    } catch (error) {
      const message =
        error instanceof ApiError ? error.message : "Couldn't block this user. Try again."
      toast.error(message)
    } finally {
      setShowBlockDialog(false)
      setBlockReason("")
    }
  }

  const handleReportConfirm = async () => {
    if (!otherUser?.id) return
    if (!csrfToken) {
      toast.error("Security token not available. Please refresh the page.")
      return
    }
    try {
      await api.post(
        "/api/moderation/reports",
        {
          targetType: "USER",
          targetId: otherUser.id,
          reason: "OTHER",
          details: reportReason.trim() || undefined,
        },
        { headers: { "X-CSRF-Token": csrfToken } }
      )
      toast.success("Report submitted")
    } catch (error) {
      const message =
        error instanceof ApiError ? error.message : "Couldn't submit the report. Try again."
      toast.error(message)
    } finally {
      setShowReportDialog(false)
      setReportReason("")
    }
  }

  return (
    <>
      <ConfirmModal isOpen={confirmOpen} onClose={() => setConfirmOpen(false)} />

      {/* Block user dialog */}
      <AlertDialog open={showBlockDialog} onOpenChange={setShowBlockDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Block User</AlertDialogTitle>
            <AlertDialogDescription>
              Optionally explain why you are blocking this user.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <textarea
            name="blockReason"
            autoComplete="off"
            aria-label="Reason for blocking (optional)"
            className="w-full rounded-md border border-border bg-background p-2 text-sm text-foreground"
            rows={3}
            value={blockReason}
            onChange={(e) => setBlockReason(e.target.value)}
            placeholder="Reason (optional)…"
            maxLength={500}
          />
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setBlockReason("")}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleBlockConfirm}>Block User</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Report user dialog */}
      <AlertDialog open={showReportDialog} onOpenChange={setShowReportDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Report User</AlertDialogTitle>
            <AlertDialogDescription>
              Please describe why you are reporting this user.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <textarea
            name="reportReason"
            autoComplete="off"
            aria-label="Reason for reporting"
            className="w-full rounded-md border border-border bg-background p-2 text-sm text-foreground"
            rows={3}
            value={reportReason}
            onChange={(e) => setReportReason(e.target.value)}
            placeholder="Describe the issue…"
            maxLength={500}
          />
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setReportReason("")}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleReportConfirm} disabled={!reportReason.trim()}>
              Submit Report
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Transition.Root show={isOpen} as={Fragment}>
        <Dialog
          as="div"
          className="relative z-50"
          onClose={onClose}
          aria-label="Conversation details"
        >
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-500"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-500"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black/40" />
          </Transition.Child>

          <div className="fixed inset-0 overflow-hidden">
            <div className="absolute inset-0 overflow-hidden">
              <div className="pointer-events-none fixed inset-y-0 right-0 flex max-w-full pl-10">
                <Transition.Child
                  as={Fragment}
                  enter="transform transition ease-in-out duration-500"
                  enterFrom="translate-x-full"
                  enterTo="translate-x-0"
                  leave="transform transition ease-in-out duration-500"
                  leaveFrom="translate-x-0"
                  leaveTo="translate-x-full"
                >
                  <Dialog.Panel className="pointer-events-auto w-screen max-w-md">
                    <div className="flex h-full flex-col overflow-y-scroll overscroll-contain bg-background py-6 shadow-xl">
                      <div className="px-4 sm:px-6">
                        <div className="flex items-start justify-end">
                          <div className="ml-3 flex h-7 items-center">
                            <button
                              type="button"
                              className="rounded-md bg-background text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                              onClick={onClose}
                              aria-label="Close panel"
                            >
                              <span className="sr-only">Close panel</span>
                              <IoClose size={24} aria-hidden="true" />
                            </button>
                          </div>
                        </div>
                      </div>
                      <div className="relative mt-6 flex-1 px-4 sm:px-6">
                        <div className="flex flex-col items-center">
                          <div className="mb-2">
                            {data.isGroup ? (
                              <AvatarGroup users={data.users} />
                            ) : (
                              <Avatar user={otherUser ?? undefined} />
                            )}
                          </div>
                          <h2 className="max-w-full break-words text-center text-base font-semibold text-foreground">
                            {title}
                          </h2>
                          <div className="text-sm text-muted-foreground">{statusText}</div>
                          <div className="my-8 flex gap-10">
                            <button
                              type="button"
                              onClick={handlePinToggle}
                              disabled={isPinning}
                              className={`flex cursor-pointer flex-col items-center gap-3 ${
                                isPinning ? "opacity-50" : "hover:opacity-75"
                              }`}
                              aria-label={isPinned ? "Unpin conversation" : "Pin conversation"}
                              aria-disabled={isPinning}
                            >
                              <div className="flex size-10 items-center justify-center rounded-full bg-muted">
                                {isPinned ? (
                                  <BsPinAngleFill size={20} aria-hidden="true" />
                                ) : (
                                  <BsPinAngle size={20} aria-hidden="true" />
                                )}
                              </div>
                              <div className="text-sm font-light text-muted-foreground">
                                {isPinned ? "Unpin" : "Pin"}
                              </div>
                            </button>
                            <button
                              type="button"
                              onClick={handleMuteToggle}
                              disabled={isMuting}
                              className={`flex cursor-pointer flex-col items-center gap-3 ${
                                isMuting ? "opacity-50" : "hover:opacity-75"
                              }`}
                              aria-label={isMuted ? "Unmute conversation" : "Mute conversation"}
                              aria-disabled={isMuting}
                            >
                              <div className="flex size-10 items-center justify-center rounded-full bg-muted">
                                {isMuted ? (
                                  <HiOutlineBell size={20} aria-hidden="true" />
                                ) : (
                                  <HiOutlineBellSlash size={20} aria-hidden="true" />
                                )}
                              </div>
                              <div className="text-sm font-light text-muted-foreground">
                                {isMuted ? "Unmute" : "Mute"}
                              </div>
                            </button>
                            <button
                              type="button"
                              onClick={handleArchiveToggle}
                              disabled={isArchiving}
                              className={`flex cursor-pointer flex-col items-center gap-3 ${
                                isArchiving ? "opacity-50" : "hover:opacity-75"
                              }`}
                              aria-label={
                                isArchived ? "Unarchive conversation" : "Archive conversation"
                              }
                              aria-disabled={isArchiving}
                            >
                              <div className="flex size-10 items-center justify-center rounded-full bg-muted">
                                {isArchived ? (
                                  <HiArchiveBoxXMark size={20} aria-hidden="true" />
                                ) : (
                                  <HiArchiveBox size={20} aria-hidden="true" />
                                )}
                              </div>
                              <div className="text-sm font-light text-muted-foreground">
                                {isArchived ? "Unarchive" : "Archive"}
                              </div>
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmOpen(true)}
                              className="flex cursor-pointer flex-col items-center gap-3 hover:opacity-75"
                              aria-label="Delete conversation"
                            >
                              <div className="flex size-10 items-center justify-center rounded-full bg-muted">
                                <IoTrash size={20} aria-hidden="true" />
                              </div>
                              <div className="text-sm font-light text-muted-foreground">Delete</div>
                            </button>
                          </div>
                          {!data.isGroup && otherUser && (
                            <div className="flex items-center justify-center gap-3 pb-6">
                              <button
                                type="button"
                                onClick={() => setShowBlockDialog(true)}
                                className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-xs text-muted-foreground hover:border-foreground hover:text-foreground"
                              >
                                <HiOutlineShieldExclamation className="size-4" aria-hidden="true" />
                                Block
                              </button>
                              <button
                                type="button"
                                onClick={() => setShowReportDialog(true)}
                                className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-xs text-muted-foreground hover:border-foreground hover:text-foreground"
                              >
                                <HiOutlineFlag className="size-4" aria-hidden="true" />
                                Report
                              </button>
                            </div>
                          )}
                          <div className="w-full py-5 sm:px-0 sm:pt-0">
                            <dl className="space-y-8 px-4 sm:space-y-6 sm:px-6">
                              {!data.isGroup && joinedDate && (
                                <>
                                  <hr className="border-border" />
                                  <div>
                                    <dt className="text-sm font-medium text-muted-foreground sm:w-40 sm:shrink-0">
                                      Joined
                                    </dt>
                                    <dd className="mt-1 text-sm text-foreground sm:col-span-2">
                                      <time dateTime={joinedAt?.toISOString()}>{joinedDate}</time>
                                    </dd>
                                  </div>
                                </>
                              )}
                            </dl>
                          </div>
                        </div>
                      </div>
                    </div>
                  </Dialog.Panel>
                </Transition.Child>
              </div>
            </div>
          </div>
        </Dialog>
      </Transition.Root>
    </>
  )
})

export default ProfileDrawer
