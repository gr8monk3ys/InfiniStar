import type { MetadataRoute } from "next"

import prisma from "@/app/lib/prismadb"
import { buildSitemap, type SitemapCharacterRow } from "@/app/lib/sitemap-data"

// CRITICAL: the `isNsfw: false` filter below is load-bearing for SEO safety.
// Public NSFW characters must NEVER appear in the sitemap. Do not relax this.
const PUBLIC_SFW_WHERE = { isPublic: true, isNsfw: false } as const

// TODO(scale): when public SFW characters approach ~50k, Next.js caps a single
// sitemap at 50,000 URLs. Add generateSitemaps() to shard by index, e.g.:
//   export async function generateSitemaps() {
//     const count = await prisma.character.count({ where: PUBLIC_SFW_WHERE })
//     const shards = Math.ceil(count / 45000)
//     return Array.from({ length: shards }, (_, id) => ({ id }))
//   }
//   export default async function sitemap({ id }: { id: number }) { ... skip/take by id ... }
// Gated behind this TODO — do not build until the catalog actually needs it.

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  let characters: SitemapCharacterRow[] = []
  let creatorIds: string[] = []

  try {
    const [characterRows, creatorRows] = await Promise.all([
      prisma.character.findMany({
        where: PUBLIC_SFW_WHERE,
        select: { slug: true, updatedAt: true, usageCount: true, likeCount: true },
        orderBy: { usageCount: "desc" },
        take: 45000,
      }),
      // Distinct creators with >=1 public SFW character.
      prisma.character.findMany({
        where: PUBLIC_SFW_WHERE,
        select: { createdById: true },
        distinct: ["createdById"],
        take: 45000,
      }),
    ])

    characters = characterRows
    creatorIds = creatorRows.map((row) => row.createdById)
  } catch (error) {
    console.error("Failed to load dynamic sitemap data", error)
  }

  return buildSitemap(characters, creatorIds)
}
