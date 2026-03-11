import Link from "next/link"
import { SignedIn, SignedOut, UserButton } from "@clerk/nextjs"

import { siteConfig } from "@/config/site"
import { buttonVariants } from "@/app/components/ui/button"
import { MainNav } from "@/app/components/main-nav"
import { ThemeToggle } from "@/app/components/theme-toggle"

export function SiteHeader() {
  return (
    <header className="glass sticky top-0 z-40 w-full border-b border-border/40">
      <div className="container flex h-16 items-center space-x-4 sm:justify-between sm:space-x-0">
        <MainNav items={siteConfig.mainNav} />
        <div className="flex flex-1 items-center justify-end space-x-4">
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
        </div>
      </div>
    </header>
  )
}
