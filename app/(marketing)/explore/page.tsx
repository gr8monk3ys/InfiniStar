import { auth } from "@clerk/nextjs/server"

import { canAccessNsfw } from "@/app/lib/nsfw"
import prisma from "@/app/lib/prismadb"
import { getRecommendationSignalsForUser, rankCharactersForUser } from "@/app/lib/recommendations"

import ExploreClient from "./ExploreClient"

export const metadata = {
  title: "Explore Characters | InfiniStar",
  description:
    "Discover community-created AI characters. Chat with anime heroes, fantasy companions, helpful assistants, and more.",
}

export const dynamic = "force-dynamic"

const CHARACTER_SELECT = {
  id: true,
  slug: true,
  name: true,
  tagline: true,
  avatarUrl: true,
  createdAt: true,
  createdById: true,
  category: true,
  usageCount: true,
  likeCount: true,
  featured: true,
  isNsfw: true,
  createdBy: {
    select: {
      id: true,
      name: true,
      image: true,
    },
  },
} as const

export default async function ExplorePage() {
  const { userId } = await auth()

  // Look up the Prisma user if logged in
  const currentUser = userId
    ? await prisma.user.findUnique({
        where: { clerkId: userId },
        select: { id: true, isAdult: true, nsfwEnabled: true },
      })
    : null
  const allowNsfw = canAccessNsfw(currentUser)
  const publicCharacterWhere = allowNsfw ? { isPublic: true } : { isPublic: true, isNsfw: false }

  const [featuredRaw, trendingRaw, allRaw, likedRecords] = await Promise.all([
    // Featured characters
    prisma.character.findMany({
      where: { ...publicCharacterWhere, featured: true },
      orderBy: { usageCount: "desc" },
      take: 24,
      select: CHARACTER_SELECT,
    }),

    // Trending characters
    prisma.character.findMany({
      where: publicCharacterWhere,
      orderBy: { usageCount: "desc" },
      take: 80,
      select: CHARACTER_SELECT,
    }),

    // All public characters (newest first)
    prisma.character.findMany({
      where: publicCharacterWhere,
      orderBy: { createdAt: "desc" },
      take: 120,
      select: CHARACTER_SELECT,
    }),

    // User's liked character IDs
    currentUser?.id
      ? prisma.characterLike.findMany({
          where: { userId: currentUser.id },
          select: { characterId: true },
        })
      : Promise.resolve([]),
  ])

  const recommendationSignals = currentUser?.id
    ? await getRecommendationSignalsForUser(currentUser.id)
    : null

  const featured = recommendationSignals
    ? rankCharactersForUser(featuredRaw, recommendationSignals).slice(0, 6)
    : featuredRaw.slice(0, 6)

  const trending = recommendationSignals
    ? rankCharactersForUser(trendingRaw, recommendationSignals).slice(0, 12)
    : trendingRaw.slice(0, 12)

  const all = recommendationSignals
    ? rankCharactersForUser(allRaw, recommendationSignals).slice(0, 24)
    : allRaw.slice(0, 24)

  const likedIds = likedRecords.map((r: { characterId: string }) => r.characterId)

  return (
    <section className="container py-8 md:py-12 lg:py-16">
      <ExploreClient featured={featured} trending={trending} all={all} likedIds={likedIds} />
    </section>
  )
}
