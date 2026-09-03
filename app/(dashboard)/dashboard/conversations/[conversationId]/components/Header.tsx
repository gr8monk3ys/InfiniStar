"use client"

import { memo, useMemo, useState } from "react"
import dynamic from "next/dynamic"
import Link from "next/link"
import { HiChevronLeft } from "react-icons/hi"
import {
  HiEllipsisVertical,
  HiLink,
  HiMagnifyingGlass,
  HiOutlineArrowDownTray,
  HiOutlineDocumentText,
  HiOutlineInformationCircle,
} from "react-icons/hi2"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/app/components/ui/dropdown-menu"
import useActiveList from "@/app/(dashboard)/dashboard/hooks/useActiveList"
import useOtherUser from "@/app/(dashboard)/dashboard/hooks/useOtherUser"
import Avatar from "@/app/components/Avatar"
import AvatarGroup from "@/app/components/AvatarGroup"
import { type FullConversationType } from "@/app/types"

import { exportOptions, useConversationExport } from "./ExportDropdown"
import { TokenUsageCompact } from "./TokenUsageDisplay"

// Lazy-load heavy overlays that are only visible on user interaction
const ProfileDrawer = dynamic(() => import("./ProfileDrawer"), {
  ssr: false,
  loading: () => null,
})

const SearchModal = dynamic(() => import("@/app/components/modals/SearchModal"), {
  ssr: false,
  loading: () => null,
})

const SummaryModal = dynamic(() => import("@/app/components/modals/SummaryModal"), {
  ssr: false,
  loading: () => null,
})

const ShareDialog = dynamic(() => import("@/app/components/sharing/ShareDialog"), {
  ssr: false,
  loading: () => null,
})

interface HeaderProps {
  conversation: FullConversationType
  currentUserId: string | null
}

const headerButtonClass =
  "inline-flex size-11 cursor-pointer items-center justify-center rounded-full text-primary transition hover:bg-accent hover:text-primary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"

/**
 * Header component - Displays conversation header with actions
 *
 * Details and search stay visible; share, summarize and export live in one
 * overflow menu so the character's name and line are what the header shows.
 *
 * Wrapped with React.memo to prevent unnecessary re-renders when parent re-renders
 * but conversation data hasn't changed.
 */
const Header: React.FC<HeaderProps> = memo(function Header({ conversation, currentUserId }) {
  const otherUser = useOtherUser(conversation)
  const { members } = useActiveList()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [searchModalOpen, setSearchModalOpen] = useState(false)
  const [summaryModalOpen, setSummaryModalOpen] = useState(false)
  const [shareDialogOpen, setShareDialogOpen] = useState(false)

  const conversationName = conversation.name || otherUser?.name || "Conversation"
  const { handleExport, isExporting, exportingFormat } = useConversationExport(
    conversation.id,
    conversationName
  )

  const isActive = members.indexOf(otherUser?.id || "") !== -1

  // Characters do not have presence: show their tagline or scenario line
  // instead of "Active"/"Offline". Humans and groups keep real presence copy.
  const statusText = useMemo(() => {
    if (conversation.isAI) {
      const line = conversation.character?.tagline || conversation.character?.scenario
      return line ? line.trim() : "Character chat"
    }

    if (conversation.isGroup) {
      return `${conversation.users.length} members`
    }

    return isActive ? "Active" : "Offline"
  }, [conversation, isActive])

  return (
    <>
      {drawerOpen && (
        <ProfileDrawer
          data={conversation}
          currentUserId={currentUserId}
          isOpen={drawerOpen}
          onClose={() => setDrawerOpen(false)}
        />
      )}
      <div className="flex w-full items-center justify-between gap-3 border-b border-border bg-background px-4 py-3 shadow-sm sm:px-4 lg:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <Link
            href="/dashboard/conversations"
            className="block shrink-0 cursor-pointer text-primary transition hover:text-primary/80 lg:hidden"
            aria-label="Back to conversations"
          >
            <HiChevronLeft size={32} />
          </Link>
          {conversation.isGroup ? (
            <AvatarGroup users={conversation.users} />
          ) : (
            <Avatar user={otherUser} />
          )}
          <div className="flex min-w-0 flex-col">
            <div className="truncate text-foreground">{conversation.name || otherUser?.name}</div>
            <div
              className="truncate text-sm font-light text-muted-foreground"
              title={conversation.isAI ? statusText : undefined}
            >
              {statusText}
            </div>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {/* Token usage display for AI conversations */}
          {conversation.isAI && (
            <TokenUsageCompact
              conversationId={conversation.id}
              isAIConversation={conversation.isAI}
            />
          )}
          <button
            onClick={() => setSearchModalOpen(true)}
            className={headerButtonClass}
            title="Search messages"
            aria-label="Search messages"
          >
            <HiMagnifyingGlass size={22} />
          </button>
          <button
            onClick={() => setDrawerOpen(true)}
            className={headerButtonClass}
            title="Conversation details"
            aria-label="Open conversation details"
          >
            <HiOutlineInformationCircle size={24} />
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className={headerButtonClass}
                title="More actions"
                aria-label="More conversation actions"
              >
                <HiEllipsisVertical size={24} />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem onSelect={() => setShareDialogOpen(true)}>
                <HiLink className="mr-2 size-4" aria-hidden="true" />
                Share conversation
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setSummaryModalOpen(true)}>
                <HiOutlineDocumentText className="mr-2 size-4" aria-hidden="true" />
                Summarize conversation
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuSub>
                <DropdownMenuSubTrigger disabled={isExporting}>
                  <HiOutlineArrowDownTray className="mr-2 size-4" aria-hidden="true" />
                  {isExporting ? "Exporting..." : "Export conversation"}
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="w-56">
                  <DropdownMenuLabel>Export as</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {exportOptions.map((option) => (
                    <DropdownMenuItem
                      key={option.format}
                      onSelect={() => handleExport(option.format)}
                      disabled={isExporting}
                      className="cursor-pointer"
                    >
                      <div className="flex flex-col gap-0.5">
                        <span className="font-medium">
                          {option.label}
                          {exportingFormat === option.format && (
                            <span className="ml-2 text-xs text-muted-foreground">Exporting...</span>
                          )}
                        </span>
                        <span className="text-xs text-muted-foreground">{option.description}</span>
                      </div>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      {searchModalOpen && (
        <SearchModal
          isOpen={searchModalOpen}
          onClose={() => setSearchModalOpen(false)}
          conversationId={conversation.id}
        />
      )}
      {summaryModalOpen && (
        <SummaryModal
          isOpen={summaryModalOpen}
          onClose={() => setSummaryModalOpen(false)}
          conversationId={conversation.id}
        />
      )}
      {shareDialogOpen && (
        <ShareDialog
          conversationId={conversation.id}
          conversationName={conversationName}
          isOpen={shareDialogOpen}
          onClose={() => setShareDialogOpen(false)}
        />
      )}
    </>
  )
})

export default Header
