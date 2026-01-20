"use client"

import { memo, useMemo, useState } from "react"
import Link from "next/link"
import { HiChevronLeft } from "react-icons/hi"
import { HiEllipsisHorizontal, HiMagnifyingGlass, HiOutlineDocumentText } from "react-icons/hi2"

import useActiveList from "@/app/(dashboard)/dashboard/hooks/useActiveList"
import useOtherUser from "@/app/(dashboard)/dashboard/hooks/useOtherUser"
import Avatar from "@/app/components/Avatar"
import AvatarGroup from "@/app/components/AvatarGroup"
import SearchModal from "@/app/components/modals/SearchModal"
import SummaryModal from "@/app/components/modals/SummaryModal"
import { ThemeToggleCompact } from "@/app/components/theme-toggle"
import { type FullConversationType } from "@/app/types"

import ExportDropdown from "./ExportDropdown"
import ProfileDrawer from "./ProfileDrawer"
import { TokenUsageCompact } from "./TokenUsageDisplay"

interface HeaderProps {
  conversation: FullConversationType
}

/**
 * Header component - Displays conversation header with actions
 *
 * Wrapped with React.memo to prevent unnecessary re-renders when parent re-renders
 * but conversation data hasn't changed.
 */
const Header: React.FC<HeaderProps> = memo(function Header({ conversation }) {
  const otherUser = useOtherUser(conversation)
  const { members } = useActiveList()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [searchModalOpen, setSearchModalOpen] = useState(false)
  const [summaryModalOpen, setSummaryModalOpen] = useState(false)

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
      <div className="flex w-full items-center justify-between border-b border-border bg-background px-4 py-3 shadow-sm sm:px-4 lg:px-6">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/conversations"
            className="block cursor-pointer text-sky-500 transition hover:text-sky-600 lg:hidden"
            aria-label="Back to conversations"
          >
            <HiChevronLeft size={32} />
          </Link>
          {conversation.isGroup ? (
            <AvatarGroup users={conversation.users} />
          ) : (
            <Avatar user={otherUser} />
          )}
          <div className="flex flex-col">
            <div className="text-foreground">{conversation.name || otherUser?.name}</div>
            <div className="text-sm font-light text-muted-foreground">{statusText}</div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {/* Token usage display for AI conversations */}
          {conversation.isAI && (
            <TokenUsageCompact
              conversationId={conversation.id}
              isAIConversation={conversation.isAI}
            />
          )}
          <ThemeToggleCompact />
          <ExportDropdown
            conversationId={conversation.id}
            conversationName={conversation.name || otherUser?.name || "Conversation"}
          />
          <button
            onClick={() => setSummaryModalOpen(true)}
            className="cursor-pointer rounded-full p-2 text-sky-500 transition hover:bg-accent hover:text-sky-600"
            title="Summarize conversation"
            aria-label="Summarize conversation"
          >
            <HiOutlineDocumentText size={24} />
          </button>
          <button
            onClick={() => setSearchModalOpen(true)}
            className="cursor-pointer rounded-full p-2 text-sky-500 transition hover:bg-accent hover:text-sky-600"
            title="Search messages"
            aria-label="Search messages"
          >
            <HiMagnifyingGlass size={24} />
          </button>
          <button
            onClick={() => setDrawerOpen(true)}
            className="cursor-pointer rounded-full p-2 text-sky-500 transition hover:bg-accent hover:text-sky-600"
            title="Conversation details"
            aria-label="Open conversation details"
          >
            <HiEllipsisHorizontal size={28} />
          </button>
        </div>
      </div>
      <SearchModal
        isOpen={searchModalOpen}
        onClose={() => setSearchModalOpen(false)}
        conversationId={conversation.id}
      />
      <SummaryModal
        isOpen={summaryModalOpen}
        onClose={() => setSummaryModalOpen(false)}
        conversationId={conversation.id}
      />
    </>
  )
})

export default Header
