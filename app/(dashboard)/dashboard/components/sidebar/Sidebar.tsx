import type getCurrentUser from "@/app/actions/getCurrentUser"

import DesktopSidebar from "./DesktopSidebar"
import MobileFooter from "./MobileFooter"

type CurrentUser = NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>

// The viewer is passed in by the layout, which already loaded it, instead of
// being fetched again here (getCurrentUser is not request-deduplicated).
function Sidebar({
  children,
  currentUser,
}: {
  children: React.ReactNode
  currentUser: CurrentUser | null
}) {
  return (
    <div className="fixed inset-y-0 left-0 z-40 size-full lg:w-20">
      <DesktopSidebar currentUser={currentUser!} />
      <MobileFooter />
      {/* The root layout already renders the page's single <main> landmark. */}
      <div className="h-full lg:pl-20">{children}</div>
    </div>
  )
}

export default Sidebar
