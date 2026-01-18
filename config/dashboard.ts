import { type DashboardConfig } from "@/app/types"

export const dashboardConfig: DashboardConfig = {
  mainNav: [
    {
      title: "Documentation",
      href: "/docs",
    },
    {
      title: "Support",
      href: "/support",
    },
  ],
  sidebarNav: [
    {
      title: "Posts",
      href: "/dashboard",
      icon: "logo",
    },
    {
      title: "Billing",
      href: "/dashboard/billing",
      icon: "twitter",
    },
    {
      title: "Settings",
      href: "/dashboard/settings",
      icon: "sun",
    },
  ],
}
