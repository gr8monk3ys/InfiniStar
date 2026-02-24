export type SiteConfig = typeof siteConfig

export const siteConfig = {
  name: "InfiniStar",
  description:
    "Chat with AI characters — anime heroes, fantasy companions, creative personalities, and more. Powered by Claude.",
  url: process.env.NEXT_PUBLIC_APP_URL || "https://infinistar.app",
  mainNav: [
    {
      title: "Home",
      href: "/",
    },
    {
      title: "Explore",
      href: "/explore",
    },
    {
      title: "Feed",
      href: "/feed",
    },
    {
      title: "Pricing",
      href: "/pricing",
    },
  ],
  links: {
    github: "https://github.com/gr8monk3ys/Infinistar",
    docs: "https://github.com/gr8monk3ys/Infinistar#readme",
  },
}
