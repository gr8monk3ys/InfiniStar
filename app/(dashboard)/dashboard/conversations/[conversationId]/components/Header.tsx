"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { HiChevronLeft } from "react-icons/hi"
import { HiEllipsisHorizontal, HiMagnifyingGlass } from "react-icons/hi2"

import useActiveList from "@/app/(dashboard)/dashboard/hooks/useActiveList"
import useOtherUser from "@/app/(dashboard)/dashboard/hooks/useOtherUser"
import Avatar from "@/app/components/Avatar"
import AvatarGroup from "@/app/components/AvatarGroup"
import SearchModal from "@/app/components/modals/SearchModal"
import { type FullConversationType } from "@/app/types"

import ProfileDrawer from "./ProfileDrawer"

interface HeaderProps {
  conversation: FullConversationType
}

const Header: React.FC<HeaderProps> = ({ conversation }) => {
  const otherUser = useOtherUser(conversation)
  const { members } = useActiveList()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [searchModalOpen, setSearchModalOpen] = useState(false)

  const isActive = members.indexOf(otherUser?.id || "") !== -1

  const statusText = useMemo(() => {
    if (conversation.isGroup) {
      return `${conversation.users.length} members`
    }

    return isActive ? "Active" : "Offline"
  }, [conversation, isActive])

  return (
    <>
      <ProfileDrawer data={conversation} isOpen={drawerOpen} onClose={() => setDrawerOpen(false)} />
      <div className="flex w-full items-center justify-between border-b bg-white px-4 py-3 shadow-sm sm:px-4 lg:px-6">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/conversations"
            className="block cursor-pointer text-sky-500 transition hover:text-sky-600 lg:hidden"
          >
            <HiChevronLeft size={32} />
          </Link>
          {conversation.isGroup ? (
            <AvatarGroup users={conversation.users} />
          ) : (
            <Avatar user={otherUser} />
          )}
          <div className="flex flex-col">
            <div>{conversation.name || otherUser?.name}</div>
            <div className="text-sm font-light text-neutral-500">{statusText}</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <HiMagnifyingGlass
            size={28}
            onClick={() => setSearchModalOpen(true)}
            className="cursor-pointer text-sky-500 transition hover:text-sky-600"
            title="Search messages"
          />
          <HiEllipsisHorizontal
            size={32}
            onClick={() => setDrawerOpen(true)}
            className="cursor-pointer text-sky-500 transition hover:text-sky-600"
          />
        </div>
      </div>
      <SearchModal
        isOpen={searchModalOpen}
        onClose={() => setSearchModalOpen(false)}
        conversationId={conversation.id}
      />
    </>
  )
}

export default Header
