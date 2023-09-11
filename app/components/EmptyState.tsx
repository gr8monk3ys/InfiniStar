"use client"

import type { ReactNode } from "react"
import { HiOutlineSparkles } from "react-icons/hi2"

interface EmptyStateProps {
  title?: string
  description?: string
  /** Optional call-to-action area rendered below the description (e.g. links or buttons). */
  action?: ReactNode
}

const EmptyState = ({
  title = "Select a chat or start a new conversation",
  description = "Choose a conversation from the sidebar or create a new one to get started.",
  action,
}: EmptyStateProps) => {
  return (
    <div
      className="
        flex
        h-full
        items-center
        justify-center
        bg-background
        px-4
        py-10
        sm:px-6
        lg:px-8
        lg:py-6
      "
    >
      <div className="flex flex-col items-center text-center">
        <div className="mb-4 rounded-full bg-primary/10 p-4">
          <HiOutlineSparkles aria-hidden="true" className="size-8 text-primary" />
        </div>
        <h3 className="mt-2 text-2xl font-semibold text-foreground">{title}</h3>
        <p className="mt-2 max-w-md text-sm text-muted-foreground">{description}</p>
        {action ? (
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">{action}</div>
        ) : null}
      </div>
    </div>
  )
}

export default EmptyState
