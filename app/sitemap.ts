import type { MetadataRoute } from "next"

export default function sitemap(): MetadataRoute.Sitemap {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://infinistar.app"
  const staticRoutes = ["/", "/pricing", "/explore", "/feed", "/privacy", "/terms"]
  return staticRoutes.map((route) => ({
    url: `${appUrl}${route}`,
    lastModified: new Date(),
    changeFrequency: route === "/" ? "weekly" : ("monthly" as const),
    priority: route === "/" ? 1.0 : 0.7,
  }))
}
