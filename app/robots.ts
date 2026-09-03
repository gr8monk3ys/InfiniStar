import type { MetadataRoute } from "next"

import { config } from "@/app/lib/config"

export default function robots(): MetadataRoute.Robots {
  const appUrl = config.appUrl
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/dashboard/", "/api/", "/sign-in", "/sign-up"],
      },
    ],
    sitemap: `${appUrl}/sitemap.xml`,
  }
}
