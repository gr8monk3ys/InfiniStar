import type { MetadataRoute } from "next"

import { siteConfig } from "@/config/site"

export interface SitemapCharacterRow {
  slug: string
  updatedAt: Date
  usageCount: number
  likeCount: number
}

export const STATIC_SITEMAP_ROUTES = [
  "/",
  "/pricing",
  "/explore",
  "/feed",
  "/privacy",
  "/terms",
] as const

/**
 * Map a character's popularity to a sitemap priority in [0.1, 1.0].
 * Log-scaled so a 100k-usage character does not drown out the long tail.
 */
function characterPriority(usageCount: number, likeCount: number): number {
  const popularity =
    Math.log10(Math.max(1, usageCount) + 1) + 0.5 * Math.log10(Math.max(1, likeCount) + 1)
  // popularity is ~0 for brand-new characters, ~7.5 for a viral one.
  const scaled = 0.4 + popularity / 12
  return Math.min(1.0, Math.max(0.1, Number(scaled.toFixed(2))))
}

/**
 * Build the full sitemap entry list from already-fetched, already-filtered
 * (public + SFW) characters and creator ids. Pure — no DB access.
 */
export function buildSitemap(
  characters: SitemapCharacterRow[],
  creatorIds: string[]
): MetadataRoute.Sitemap {
  const base = siteConfig.url
  const now = new Date()

  const staticEntries: MetadataRoute.Sitemap = STATIC_SITEMAP_ROUTES.map((route) => ({
    url: `${base}${route}`,
    lastModified: now,
    changeFrequency: route === "/" ? "weekly" : "monthly",
    priority: route === "/" ? 1.0 : 0.7,
  }))

  const characterEntries: MetadataRoute.Sitemap = characters.map((character) => ({
    url: `${base}/characters/${character.slug}`,
    lastModified: character.updatedAt,
    changeFrequency: "weekly",
    priority: characterPriority(character.usageCount, character.likeCount),
  }))

  const creatorEntries: MetadataRoute.Sitemap = creatorIds.map((id) => ({
    url: `${base}/creators/${id}`,
    lastModified: now,
    changeFrequency: "weekly",
    priority: 0.5,
  }))

  return [...staticEntries, ...characterEntries, ...creatorEntries]
}
