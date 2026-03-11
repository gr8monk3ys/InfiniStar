"use client"

import Link from "next/link"
import { SignedIn, SignedOut, UserButton } from "@clerk/nextjs"

import { buttonVariants } from "@/app/components/ui/button"
import { ThemeToggle } from "@/app/components/theme-toggle"

export function HeaderActions() {
  return (
    <nav className="flex items-center space-x-2">
      <ThemeToggle />
      <SignedOut>
        <Link href="/sign-in" className={buttonVariants({ size: "sm", variant: "ghost" })}>
          Sign In
        </Link>
        <Link href="/sign-up" className={buttonVariants({ size: "sm", variant: "gradient" })}>
          Create Account
        </Link>
      </SignedOut>
      <SignedIn>
        <UserButton afterSignOutUrl="/" />
      </SignedIn>
    </nav>
  )
}
