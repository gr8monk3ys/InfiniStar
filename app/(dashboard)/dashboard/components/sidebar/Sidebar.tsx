import getCurrentUser from '@/app/actions/getCurrentUser';

import DesktopSidebar from './DesktopSidebar';
import MobileFooter from './MobileFooter';

async function Sidebar({ children }: {
  children: React.ReactNode,
}) {
  const currentUser = await getCurrentUser();

  return (
    <div className="fixed inset-y-0 left-0 z-40 size-full lg:w-20">
      <DesktopSidebar currentUser={currentUser!} />
      <MobileFooter />
      <main className="h-full lg:pl-20">
        {children}
      </main>
    </div>
  )
}

export default Sidebar;
