import Link from "next/link"

import { CHARACTER_SELECT } from "@/app/lib/character-select"
import { canAccessNsfw } from "@/app/lib/nsfw"
import prisma from "@/app/lib/prismadb"
import { getRecommendationSignalsForUser, rankCharactersForUser } from "@/app/lib/recommendations"
import { cn } from "@/app/lib/utils"
import { buttonVariants } from "@/app/components/ui/button"
import getCurrentUser from "@/app/actions/getCurrentUser"
import { EmptySection } from "@/app/components/EmptySection"
import { RetryButton } from "@/app/components/RetryButton"

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
  const currentUser = await getCurrentUser()
  const allowNsfw = canAccessNsfw(currentUser)
  const publicCharacterWhere = allowNsfw ? { isPublic: true } : { isPublic: true, isNsfw: false }

  let featuredRaw: ExploreCharacter[] = []
  let trendingRaw: ExploreCharacter[] = []
  let allRaw: ExploreCharacter[] = []
  let likedRecords: Array<{ characterId: string }> = []
  let recommendationSignals = null
  let catalogError = false

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
    // Same rule as the feed: a failed query must not render as an empty catalog.
    catalogError = true
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

  if (catalogError) {
    return (
      <section className="container py-8 md:py-12 lg:py-16">
        <EmptySection
          variant="error"
          title="We couldn't load the catalog right now"
          description="The character catalog didn't come back on this request. This is a fault on our side, not an empty marketplace, so there is nothing for you to fix. Try again in a moment."
          action={
            <>
              <RetryButton />
              <Link href="/feed" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
                Visit the creator feed
              </Link>
            </>
          }
        />
      </section>
    )
  }

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
