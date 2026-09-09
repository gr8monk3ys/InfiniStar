import { config } from "@/app/lib/config"

export type SiteConfig = typeof siteConfig

export const siteConfig = {
  name: "InfiniStar",
  description:
    "Chat with AI characters — anime heroes, fantasy companions, creative personalities, and more. Powered by Claude.",

  /**
   * Both of these defer to `config` rather than reading the environment again.
   * They were the fifteenth and sixteenth places that answered "what is our
   * URL" and "what is our support address", and they answered
   * `https://infinistar.app` — a domain that was never registered, so the
   * canonical URL and the support link on every page pointed at nothing.
   *
   * Getters, not values: `config` warns when a variable is missing in
   * production, and a value here would fire that warning at import time in
   * development, where it is noise.
   */
  get url(): string {
    return config.appUrl
  },
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
    get support(): string {
      return `mailto:${config.supportEmail}`
    },
  },
}
