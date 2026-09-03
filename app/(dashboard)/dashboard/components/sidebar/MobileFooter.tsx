"use client"

import { HiOutlineQuestionMarkCircle } from "react-icons/hi2"

import useConversation from "@/app/(dashboard)/dashboard/hooks/useConversation"
import useRoutes from "@/app/(dashboard)/dashboard/hooks/useRoutes"

import { useKeyboardShortcutsContext } from "../KeyboardShortcutsProvider"
import MobileItem from "./MobileItem"

const MobileFooter = () => {
  const routes = useRoutes()
  const { isOpen } = useConversation()
  const { openHelp } = useKeyboardShortcutsContext()

  if (isOpen) {
    return null
  }

  return (
    <div
      className="
        fixed
        bottom-0
        z-40
        flex
        w-full
        items-center
        justify-between
        border-t
        border-border
        bg-background
        pb-[env(safe-area-inset-bottom)]
        lg:hidden
      "
    >
      {routes.map((route) => (
        <MobileItem
          key={route.href}
          label={route.label}
          href={route.href}
          active={route.active}
          icon={route.icon}
          onClick={route.onClick}
          separated={route.label === "Logout"}
        />
      ))}
      {/* Keyboard shortcuts help button */}
      <button
        onClick={openHelp}
        className="group flex w-full cursor-pointer flex-col items-center justify-center gap-y-1 px-1 py-2.5 font-medium leading-6 text-muted-foreground transition hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
      >
        <HiOutlineQuestionMarkCircle size={24} aria-hidden="true" />
        <span className="max-w-full truncate text-xs leading-none">Help</span>
      </button>
    </div>
  )
}

export default MobileFooter
