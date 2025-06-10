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
        lg:hidden
      "
    >
      {routes.map((route) => (
        <MobileItem
          key={route.href}
          href={route.href}
          active={route.active}
          icon={route.icon}
          onClick={route.onClick}
        />
      ))}
      {/* Keyboard shortcuts help button */}
      <button
        onClick={openHelp}
        className="group flex w-full cursor-pointer items-center justify-center gap-x-3 p-4 text-sm font-semibold leading-6 text-muted-foreground transition hover:bg-accent hover:text-foreground focus:outline-none"
        aria-label="Keyboard shortcuts"
      >
        <HiOutlineQuestionMarkCircle size={24} aria-hidden="true" />
      </button>
    </div>
  )
}

export default MobileFooter
