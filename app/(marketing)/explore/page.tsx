import { auth } from "@clerk/nextjs/server"

import { canAccessNsfw } from "@/app/lib/nsfw"
import prisma from "@/app/lib/prismadb"
import { getRecommendationSignalsForUser, rankCharactersForUser } from "@/app/lib/recommendations"

import ExploreClient from "./ExploreClient"

export const metadata = {
  title: "Explore Characters | InfiniStar",
  description:
    "Discover community-created AI characters. Chat with anime heroes, fantasy companions, helpful assistants, and more.",
  alternates: {
    canonical: "/explore",
  },
  openGraph: {
    title: "Explore Characters | InfiniStar",
    description:
      "Discover community-created AI characters. Chat with anime heroes, fantasy companions, helpful assistants, and more.",
    url: "/explore",
  },
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
  commentCount: true,
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

interface ExploreCharacter {
  id: string
  slug: string
  name: string
  tagline: string | null
  avatarUrl: string | null
  createdAt: Date
  createdById: string
  category: string
  usageCount: number
  likeCount: number
  commentCount: number
  featured: boolean
  isNsfw: boolean
  createdBy: {
    id: string
    name: string | null
    image: string | null
  } | null
}

interface ExplorePageProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

function getFirstSearchParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}

export default async function ExplorePage({ searchParams }: ExplorePageProps) {
  const resolvedSearchParams = (await searchParams) ?? {}
  const { userId } = await auth()

  // Look up the Prisma user if logged in
  let currentUser: {
    id: string
    isAdult: boolean
    nsfwEnabled: boolean
    adultConfirmedAt: Date | null
  } | null = null

  if (userId) {
    try {
      currentUser = await prisma.user.findUnique({
        where: { clerkId: userId },
        select: { id: true, isAdult: true, nsfwEnabled: true, adultConfirmedAt: true },
      })
    } catch (error) {
      console.error("Failed to load current user for explore page", error)
    }
  }
  const allowNsfw = canAccessNsfw(currentUser)
  const publicCharacterWhere = allowNsfw ? { isPublic: true } : { isPublic: true, isNsfw: false }

  let featuredRaw: ExploreCharacter[] = []
  let trendingRaw: ExploreCharacter[] = []
  let allRaw: ExploreCharacter[] = []
  let likedRecords: Array<{ characterId: string }> = []
  let recommendationSignals = null

  try {
    ;[featuredRaw, trendingRaw, allRaw, likedRecords] = await Promise.all([
      prisma.character.findMany({
        where: { ...publicCharacterWhere, featured: true },
        orderBy: { usageCount: "desc" },
        take: 24,
        select: CHARACTER_SELECT,
      }),
      prisma.character.findMany({
        where: publicCharacterWhere,
        orderBy: [{ usageCount: "desc" }, { commentCount: "desc" }, { likeCount: "desc" }],
        take: 80,
        select: CHARACTER_SELECT,
      }),
      prisma.character.findMany({
        where: publicCharacterWhere,
        orderBy: { createdAt: "desc" },
        take: 120,
        select: CHARACTER_SELECT,
      }),
      currentUser?.id
        ? prisma.characterLike.findMany({
            where: { userId: currentUser.id },
            select: { characterId: true },
          })
        : Promise.resolve([]),
    ])

    recommendationSignals = currentUser?.id
      ? await getRecommendationSignalsForUser(currentUser.id)
      : null
  } catch (error) {
    console.error("Failed to load explore page data", error)
  }

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
  const initialCategory = getFirstSearchParam(resolvedSearchParams.category)
  const initialSearchQuery = getFirstSearchParam(resolvedSearchParams.q)

  return (
    <section className="container py-8 md:py-12 lg:py-16">
      <ExploreClient
        featured={featured}
        trending={trending}
        all={all}
        likedIds={likedIds}
        initialCategory={initialCategory}
        initialSearchQuery={initialSearchQuery}
      />
    </section>
  )
}
