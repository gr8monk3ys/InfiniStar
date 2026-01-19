"use client"

import { Fragment, memo, useMemo, useState } from "react"
import { Dialog, Transition } from "@headlessui/react"
import axios, { isAxiosError } from "axios"
import { format } from "date-fns"
import { useSession } from "next-auth/react"
import toast from "react-hot-toast"
import { BsPinAngle, BsPinAngleFill } from "react-icons/bs"
import { HiArchiveBox, HiArchiveBoxXMark, HiOutlineBell, HiOutlineBellSlash } from "react-icons/hi2"
import { IoClose, IoTrash } from "react-icons/io5"

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
}) {
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [isArchiving, setIsArchiving] = useState(false)
  const [isPinning, setIsPinning] = useState(false)
  const [isMuting, setIsMuting] = useState(false)
  const session = useSession()
  const { token: csrfToken } = useCsrfToken()
  const otherUser = useOtherUser(data)

  const joinedDate = useMemo(() => {
    return format(new Date(otherUser.createdAt), "PP")
  }, [otherUser.createdAt])

  const title = useMemo(() => {
    return data.title || otherUser.name
  }, [data.title, otherUser.name])

  const { members, getPresence } = useActiveList()
  const isActive = members.indexOf(otherUser?.id!) !== -1
  const presence = otherUser?.id ? getPresence(otherUser.id) : null

  const statusText = useMemo(() => {
    if (data.isGroup) {
      return `${data.users.length} members`
    }

    // Show custom status if available
    if (presence?.customStatus) {
      const emoji = presence.customStatusEmoji || ""
      return `${emoji} ${presence.customStatus}`.trim()
    }

    // Show presence status
    const presenceStatus = presence?.presenceStatus || (isActive ? "online" : "offline")

    switch (presenceStatus) {
      case "online":
        return "Active"
      case "away":
        return "Away"
      case "offline":
      default:
        return "Offline"
    }
  }, [data, isActive, presence])

  const isArchived = useMemo(() => {
    const currentUserId = session.data?.user?.id
    if (!currentUserId) return false
    return data.archivedBy?.includes(currentUserId) || false
  }, [data.archivedBy, session.data?.user?.id])

  const isPinned = useMemo(() => {
    const currentUserId = session.data?.user?.id
    if (!currentUserId) return false
    return data.pinnedBy?.includes(currentUserId) || false
  }, [data.pinnedBy, session.data?.user?.id])

  const isMuted = useMemo(() => {
    const currentUserId = session.data?.user?.id
    if (!currentUserId) return false
    return data.mutedBy?.includes(currentUserId) || false
  }, [data.mutedBy, session.data?.user?.id])

  const handleArchiveToggle = async () => {
    setIsArchiving(true)
    try {
      const headers = csrfToken ? { "X-CSRF-Token": csrfToken } : {}
      if (isArchived) {
        // Unarchive
        await axios.delete(`/api/conversations/${data.id}/archive`, { headers })
        toast.success("Conversation unarchived")
      } else {
        // Archive
        await axios.post(`/api/conversations/${data.id}/archive`, {}, { headers })
        toast.success("Conversation archived")
      }
    } catch (error) {
      const message =
        isAxiosError(error) && error.response?.data?.error
          ? error.response.data.error
          : "Failed to update archive status"
      toast.error(message)
    } finally {
      setIsArchiving(false)
    }
  }

  const handlePinToggle = async () => {
    setIsPinning(true)
    try {
      const headers = csrfToken ? { "X-CSRF-Token": csrfToken } : {}
      if (isPinned) {
        // Unpin
        await axios.delete(`/api/conversations/${data.id}/pin`, { headers })
        toast.success("Conversation unpinned")
      } else {
        // Pin
        await axios.post(`/api/conversations/${data.id}/pin`, {}, { headers })
        toast.success("Conversation pinned")
      }
    } catch (error) {
      const message =
        isAxiosError(error) && error.response?.data?.error
          ? error.response.data.error
          : "Failed to update pin status"
      toast.error(message)
    } finally {
      setIsPinning(false)
    }
  }

  const handleMuteToggle = async () => {
    setIsMuting(true)
    try {
      const headers = csrfToken ? { "X-CSRF-Token": csrfToken } : {}
      if (isMuted) {
        // Unmute
        await axios.delete(`/api/conversations/${data.id}/mute`, { headers })
        toast.success("Conversation unmuted")
      } else {
        // Mute
        await axios.post(`/api/conversations/${data.id}/mute`, {}, { headers })
        toast.success("Conversation muted")
      }
    } catch (error) {
      const message =
        isAxiosError(error) && error.response?.data?.error
          ? error.response.data.error
          : "Failed to update mute status"
      toast.error(message)
    } finally {
      setIsMuting(false)
    }
  }

  return (
    <>
      <ConfirmModal isOpen={confirmOpen} onClose={() => setConfirmOpen(false)} />
      <Transition.Root show={isOpen} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={onClose}>
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
                    <div className="flex h-full flex-col overflow-y-scroll bg-white py-6 shadow-xl">
                      <div className="px-4 sm:px-6">
                        <div className="flex items-start justify-end">
                          <div className="ml-3 flex h-7 items-center">
                            <button
                              type="button"
                              className="rounded-md bg-white text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                              onClick={onClose}
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
                              <Avatar user={otherUser} />
                            )}
                          </div>
                          <div>{title}</div>
                          <div className="text-sm text-gray-500">{statusText}</div>
                          <div className="my-8 flex gap-10">
                            <div
                              onClick={handlePinToggle}
                              className={`flex cursor-pointer flex-col items-center gap-3 ${
                                isPinning ? "opacity-50" : "hover:opacity-75"
                              }`}
                              aria-label={isPinned ? "Unpin conversation" : "Pin conversation"}
                              aria-disabled={isPinning}
                            >
                              <div className="flex size-10 items-center justify-center rounded-full bg-neutral-100">
                                {isPinned ? <BsPinAngleFill size={20} /> : <BsPinAngle size={20} />}
                              </div>
                              <div className="text-sm font-light text-neutral-600">
                                {isPinned ? "Unpin" : "Pin"}
                              </div>
                            </div>
                            <div
                              onClick={handleMuteToggle}
                              className={`flex cursor-pointer flex-col items-center gap-3 ${
                                isMuting ? "opacity-50" : "hover:opacity-75"
                              }`}
                              aria-label={isMuted ? "Unmute conversation" : "Mute conversation"}
                              aria-disabled={isMuting}
                            >
                              <div className="flex size-10 items-center justify-center rounded-full bg-neutral-100">
                                {isMuted ? (
                                  <HiOutlineBell size={20} />
                                ) : (
                                  <HiOutlineBellSlash size={20} />
                                )}
                              </div>
                              <div className="text-sm font-light text-neutral-600">
                                {isMuted ? "Unmute" : "Mute"}
                              </div>
                            </div>
                            <div
                              onClick={handleArchiveToggle}
                              className={`flex cursor-pointer flex-col items-center gap-3 ${
                                isArchiving ? "opacity-50" : "hover:opacity-75"
                              }`}
                              aria-label={
                                isArchived ? "Unarchive conversation" : "Archive conversation"
                              }
                              aria-disabled={isArchiving}
                            >
                              <div className="flex size-10 items-center justify-center rounded-full bg-neutral-100">
                                {isArchived ? (
                                  <HiArchiveBoxXMark size={20} />
                                ) : (
                                  <HiArchiveBox size={20} />
                                )}
                              </div>
                              <div className="text-sm font-light text-neutral-600">
                                {isArchived ? "Unarchive" : "Archive"}
                              </div>
                            </div>
                            <div
                              onClick={() => setConfirmOpen(true)}
                              className="flex cursor-pointer flex-col items-center gap-3 hover:opacity-75"
                            >
                              <div className="flex size-10 items-center justify-center rounded-full bg-neutral-100">
                                <IoTrash size={20} />
                              </div>
                              <div className="text-sm font-light text-neutral-600">Delete</div>
                            </div>
                          </div>
                          <div className="w-full py-5 sm:px-0 sm:pt-0">
                            <dl className="space-y-8 px-4 sm:space-y-6 sm:px-6">
                              {data.isGroup && (
                                <div>
                                  <dt className="text-sm font-medium text-gray-500 sm:w-40 sm:shrink-0">
                                    Emails
                                  </dt>
                                  <dd className="mt-1 text-sm text-gray-900 sm:col-span-2">
                                    {data.users.map((user) => user.email).join(", ")}
                                  </dd>
                                </div>
                              )}
                              {!data.isGroup && (
                                <div>
                                  <dt className="text-sm font-medium text-gray-500 sm:w-40 sm:shrink-0">
                                    Email
                                  </dt>
                                  <dd className="mt-1 text-sm text-gray-900 sm:col-span-2">
                                    {otherUser.email}
                                  </dd>
                                </div>
                              )}
                              {!data.isGroup && (
                                <>
                                  <hr />
                                  <div>
                                    <dt className="text-sm font-medium text-gray-500 sm:w-40 sm:shrink-0">
                                      Joined
                                    </dt>
                                    <dd className="mt-1 text-sm text-gray-900 sm:col-span-2">
                                      <time dateTime={joinedDate}>{joinedDate}</time>
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
