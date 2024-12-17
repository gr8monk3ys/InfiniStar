'use client';

import DesktopItem from "./DesktopItem";
import useRoutes from "@/app/(dashboard)/dashboard/hooks/useRoutes";
import SettingsModal from "./SettingsModal";
import { useState } from "react";
import Avatar from "../Avatar";
import { User } from "@prisma/client";

interface DesktopSidebarProps {
  currentUser: User
}

const DesktopSidebar: React.FC<DesktopSidebarProps> = ({
  currentUser
}) => {
  const routes = useRoutes();
  const [isOpen, setIsOpen] = useState(false);

  console.log({ currentUser, }, 'TEST')

  return ( 
    <>
      <SettingsModal currentUser={currentUser} isOpen={isOpen} onClose={() => setIsOpen(false)} />
      <div 
        className="
          hidden 
          lg:fixed 
          lg:inset-y-0 
          lg:left-0 
          lg:z-40 
          lg:flex 
          lg:w-20 
          lg:flex-col 
          lg:overflow-y-auto 
          lg:border-r 
          lg:bg-white 
          lg:pb-4
        "
      >
        <nav className="mt-4 flex flex-col justify-between">
          <ul role="list" className="flex flex-col items-center space-y-1">
            {routes.map((item) => (
              <DesktopItem
                key={item.label}
                href={item.href}
                label={item.label}
                icon={item.icon}
                active={item.active}
                onClick={item.onClick}
              />
            ))}
          </ul>
        </nav>
        <nav className="mt-4 flex flex-col items-center justify-between">
          <div 
            onClick={() => setIsOpen(true)} 
            className="cursor-pointer transition hover:opacity-75"
          >
            <Avatar user={currentUser} />
          </div>
        </nav>
      </div>
    </>
   );
}
 
export default DesktopSidebar;