import { siteConfig } from "@/config/site"
import { HeaderActions } from "@/app/components/header-actions"
import { MainNav } from "@/app/components/main-nav"

export function SiteHeader() {
  return (
    <header className="glass sticky top-0 z-40 w-full border-b border-border/40">
      <div className="container flex h-16 items-center space-x-4 sm:justify-between sm:space-x-0">
        <MainNav items={siteConfig.mainNav} />
        <div className="flex flex-1 items-center justify-end space-x-4">
          <HeaderActions />
        </div>
      </div>
    </header>
  )
}
