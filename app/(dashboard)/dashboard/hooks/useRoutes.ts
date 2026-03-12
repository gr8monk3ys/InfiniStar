import { useMemo } from "react"
import { usePathname } from "next/navigation"
import { HiChat } from "react-icons/hi"
import {
  HiArrowLeftOnRectangle,
  HiCurrencyDollar,
  HiOutlineSparkles,
  HiUser,
} from "react-icons/hi2"

import { useAppAuth } from "@/app/hooks/useAppAuth"

import useConversation from "./useConversation"

const useRoutes = () => {
  const pathname = usePathname()
  const { conversationId } = useConversation()
  const { signOut } = useAppAuth()

  const routes = useMemo(
    () => [
      {
        label: "Chat",
        href: "/dashboard/conversations",
        icon: HiChat,
        active: pathname?.startsWith("/dashboard/conversations") || !!conversationId,
      },
      {
        label: "Characters",
        href: "/dashboard/characters",
        icon: HiOutlineSparkles,
        active: pathname?.startsWith("/dashboard/characters"),
      },
      {
        label: "Profile",
        href: "/dashboard/profile",
        icon: HiUser,
        active: pathname?.startsWith("/dashboard/profile"),
      },
      {
        label: "Earnings",
        href: "/dashboard/creator-earnings",
        icon: HiCurrencyDollar,
        active: pathname?.startsWith("/dashboard/creator-earnings"),
      },
      {
        label: "Logout",
        onClick: () => {
          void signOut({ redirectUrl: "/" })
        },
        href: "#",
        icon: HiArrowLeftOnRectangle,
      },
    ],
    [pathname, conversationId, signOut]
  )

  return routes
}

export default useRoutes
