"use client"

import Link from "next/link"
import clsx from "clsx"

import { cn } from "@/app/lib/utils"
import { buttonVariants } from "@/app/components/ui/button"
import EmptyState from "@/app/components/EmptyState"

import useConversation from "../hooks/useConversation"

const Home = () => {
  const { isOpen } = useConversation()

  return (
    <div className={clsx("lg:pl-80 h-full lg:block", isOpen ? "block" : "hidden")}>
      <EmptyState
        description="Pick a conversation from the sidebar, or meet a character and start chatting right away."
        action={
          <>
            <Link href="/explore" className={cn(buttonVariants({ variant: "default" }))}>
              Discover characters
            </Link>
            <Link
              href="/dashboard/characters/new"
              className={cn(buttonVariants({ variant: "outline" }))}
            >
              Create your own
            </Link>
          </>
        }
      />
    </div>
  )
}

export default Home
