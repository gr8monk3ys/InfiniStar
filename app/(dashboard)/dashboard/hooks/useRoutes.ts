import { useMemo } from "react"
import { usePathname } from "next/navigation"
import { signOut } from "next-auth/react"
import { HiChat } from "react-icons/hi"
import { HiArrowLeftOnRectangle, HiOutlineSparkles, HiUser } from "react-icons/hi2"

import useConversation from "./useConversation"

const useRoutes = () => {
  const pathname = usePathname()
  const { conversationId } = useConversation()

  const routes = useMemo(
    () => [
      {
        label: "Chat",
        href: "/conversations",
        icon: HiChat,
        active: pathname === "/conversations" || !!conversationId,
      },
      {
        label: "Characters",
        href: "/dashboard/characters",
        icon: HiOutlineSparkles,
        active: pathname?.startsWith("/dashboard/characters"),
      },
      {
        label: "user",
        href: "/user",
        icon: HiUser,
        active: pathname === "/user",
      },
      {
        label: "Logout",
        onClick: () => signOut(),
        href: "#",
        icon: HiArrowLeftOnRectangle,
      },
    ],
    [pathname, conversationId]
  )

  return routes
}

export default useRoutes
