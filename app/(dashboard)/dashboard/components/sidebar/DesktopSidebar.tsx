"use client"

import { useState } from "react"
import { type User } from "@prisma/client"
import { HiOutlineQuestionMarkCircle } from "react-icons/hi2"

import useRoutes from "@/app/(dashboard)/dashboard/hooks/useRoutes"
import Avatar from "@/app/components/Avatar"

import { useKeyboardShortcutsContext } from "../KeyboardShortcutsProvider"
import DesktopItem from "./DesktopItem"
import SettingsModal from "./SettingsModal"

interface DesktopSidebarProps {
  currentUser: User
}

const DesktopSidebar: React.FC<DesktopSidebarProps> = ({ currentUser }) => {
  const routes = useRoutes()
  const [isOpen, setIsOpen] = useState(false)
  const { openHelp } = useKeyboardShortcutsContext()

  return (
    <>
      <SettingsModal currentUser={currentUser} isOpen={isOpen} onClose={() => setIsOpen(false)} />
      <div
        className="
          hidden
          lg:fixed
          lg:inset-y-0
          lg:left-0
          lg:z-40
          lg:flex
          lg:w-20
          lg:flex-col
          lg:overflow-y-auto
          lg:border-r
          lg:border-border
          lg:bg-background
          lg:pb-4
        "
      >
        <nav className="mt-4 flex flex-col justify-between">
          <ul role="list" className="flex flex-col items-center space-y-1">
            {routes.map((item) => (
              <DesktopItem
                key={item.label}
                href={item.href}
                label={item.label}
                icon={item.icon}
                active={item.active}
                onClick={item.onClick}
              />
            ))}
          </ul>
        </nav>
        <nav className="mt-auto flex flex-col items-center gap-3 pb-4">
          {/* Keyboard shortcuts help button */}
          <button
            onClick={openHelp}
            className="group relative flex cursor-pointer items-center justify-center rounded-md p-3 text-muted-foreground transition hover:bg-accent hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            aria-label="Keyboard shortcuts (press ? or Cmd+/)"
            title="Keyboard shortcuts (?)"
          >
            <HiOutlineQuestionMarkCircle size={24} aria-hidden="true" />
            <span className="sr-only">Keyboard shortcuts</span>
          </button>
          {/* User avatar */}
          <div
            onClick={() => setIsOpen(true)}
            className="cursor-pointer transition hover:opacity-75"
          >
            <Avatar user={currentUser} />
          </div>
        </nav>
      </div>
    </>
  )
}

export default DesktopSidebar
