"use client"

import { HiOutlineSparkles } from "react-icons/hi2"

const EmptyState = () => {
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
          <HiOutlineSparkles className="size-8 text-primary" />
        </div>
        <h3 className="mt-2 text-2xl font-semibold text-foreground">
          Select a chat or start a new conversation
        </h3>
        <p className="mt-2 text-sm text-muted-foreground">
          Choose a conversation from the sidebar or create a new one to get started.
        </p>
      </div>
    </div>
  )
}

export default EmptyState
