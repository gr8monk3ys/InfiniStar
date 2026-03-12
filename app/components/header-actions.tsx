import Link from "next/link"
import { auth } from "@clerk/nextjs/server"

import { buttonVariants } from "@/app/components/ui/button"
import { ThemeToggleCompact } from "@/app/components/theme-toggle"

export async function HeaderActions() {
  const { userId } = await auth()

  return (
    <nav className="flex items-center space-x-2">
      <ThemeToggleCompact />
      {userId ? (
        <Link href="/dashboard" className={buttonVariants({ size: "sm", variant: "gradient" })}>
          Open App
        </Link>
      ) : (
        <>
          <Link href="/sign-in" className={buttonVariants({ size: "sm", variant: "ghost" })}>
            Sign In
          </Link>
          <Link href="/sign-up" className={buttonVariants({ size: "sm", variant: "gradient" })}>
            Create Account
          </Link>
        </>
      )}
    </nav>
  )
}
