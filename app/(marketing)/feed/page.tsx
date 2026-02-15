import Image from "next/image"
import Link from "next/link"
import { auth } from "@clerk/nextjs/server"
import { HiArrowTrendingUp, HiChatBubbleLeftRight, HiSparkles, HiUserGroup } from "react-icons/hi2"

import { canAccessNsfw } from "@/app/lib/nsfw"
import prisma from "@/app/lib/prismadb"
import { getRecommendationSignalsForUser, rankCharactersForUser } from "@/app/lib/recommendations"
import { cn } from "@/app/lib/utils"
import { buttonVariants } from "@/app/components/ui/button"
import { CharacterCard } from "@/app/components/characters/CharacterCard"

export const metadata = {
  title: "Community Feed | InfiniStar",
  description:
    "See trending characters, discover new creators, and follow what the InfiniStar community is building.",
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

interface CreatorSummary {
  id: string
  name: string | null
  image: string | null
  bio: string | null
  publicCharacterCount: number
  totalUsageCount: number
  totalLikeCount: number
}

export default async function FeedPage() {
  const { userId } = await auth()
  const currentUser = userId
    ? await prisma.user.findUnique({
        where: { clerkId: userId },
        select: { id: true, isAdult: true, nsfwEnabled: true },
      })
    : null
  const allowNsfw = canAccessNsfw(currentUser)
  const publicCharacterWhere = allowNsfw ? { isPublic: true } : { isPublic: true, isNsfw: false }

  const [trendingRaw, freshRaw, creatorRows] = await Promise.all([
    prisma.character.findMany({
      where: publicCharacterWhere,
      orderBy: [{ usageCount: "desc" }, { likeCount: "desc" }],
      take: 60,
      select: CHARACTER_SELECT,
    }),
    prisma.character.findMany({
      where: publicCharacterWhere,
      orderBy: { createdAt: "desc" },
      take: 60,
      select: CHARACTER_SELECT,
    }),
    prisma.user.findMany({
      where: {
        characters: {
          some: publicCharacterWhere,
        },
      },
      select: {
        id: true,
        name: true,
        image: true,
        bio: true,
        characters: {
          where: publicCharacterWhere,
          select: { usageCount: true, likeCount: true },
        },
      },
      take: 30,
    }),
  ])

  const recommendationSignals = currentUser?.id
    ? await getRecommendationSignalsForUser(currentUser.id)
    : null

  const followingCreatorIds = currentUser?.id
    ? (
        await prisma.userFollow.findMany({
          where: { followerId: currentUser.id },
          select: { followingId: true },
          take: 1000,
        })
      ).map((row) => row.followingId)
    : []

  const followingRaw =
    followingCreatorIds.length > 0
      ? await prisma.character.findMany({
          where: {
            ...publicCharacterWhere,
            createdById: { in: followingCreatorIds },
          },
          orderBy: [{ createdAt: "desc" }, { usageCount: "desc" }],
          take: 60,
          select: CHARACTER_SELECT,
        })
      : []

  const trendingCharacters = recommendationSignals
    ? rankCharactersForUser(trendingRaw, recommendationSignals).slice(0, 8)
    : trendingRaw.slice(0, 8)

  const freshCharacters = recommendationSignals
    ? rankCharactersForUser(freshRaw, recommendationSignals).slice(0, 8)
    : freshRaw.slice(0, 8)

  const followingCharacters = recommendationSignals
    ? rankCharactersForUser(followingRaw, recommendationSignals).slice(0, 8)
    : followingRaw.slice(0, 8)

  const topCreators: CreatorSummary[] = creatorRows
    .map((creator) => {
      const totalUsageCount = creator.characters.reduce(
        (sum: number, character: { usageCount: number }) => sum + character.usageCount,
        0
      )
      const totalLikeCount = creator.characters.reduce(
        (sum: number, character: { likeCount: number }) => sum + character.likeCount,
        0
      )

      return {
        id: creator.id,
        name: creator.name,
        image: creator.image,
        bio: creator.bio,
        publicCharacterCount: creator.characters.length,
        totalUsageCount,
        totalLikeCount,
      }
    })
    .sort((a, b) => b.totalUsageCount - a.totalUsageCount)
    .slice(0, 6)

  return (
    <section className="container flex flex-col gap-10 py-8 md:py-12 lg:py-16">
      <div className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-primary/5 via-background to-blue-500/5 p-8 md:p-12">
        <div className="pointer-events-none absolute right-0 top-0 h-48 w-48 rounded-full bg-primary/10 blur-3xl" />
        <div className="relative max-w-3xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
            <HiSparkles className="size-4" />
            Community Highlights
          </div>
          <h1 className="mt-4 text-3xl font-bold tracking-tight md:text-5xl">Creator Feed</h1>
          <p className="mt-3 text-sm text-muted-foreground md:text-base">
            Follow trending characters, discover breakout creators, and jump straight into the
            latest community experiences.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/explore" className={cn(buttonVariants({ size: "sm" }), "gap-2")}>
              <HiChatBubbleLeftRight className="size-4" />
              Explore Characters
            </Link>
            <Link
              href="/dashboard/characters/new"
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              Create Character
            </Link>
          </div>
        </div>
      </div>

      <section>
        <div className="mb-4 flex items-center gap-2">
          <HiUserGroup className="size-5 text-primary" />
          <h2 className="text-xl font-semibold">Top Creators</h2>
        </div>

        {topCreators.length === 0 ? (
          <div className="rounded-xl border border-dashed p-8 text-sm text-muted-foreground">
            No creator data available yet.
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {topCreators.map((creator) => (
              <Link
                key={creator.id}
                href={`/creators/${creator.id}`}
                className="group rounded-xl border bg-card p-4 transition-colors hover:border-primary/30 hover:bg-accent/30"
              >
                <div className="flex items-center gap-3">
                  {creator.image ? (
                    <div className="relative size-12 overflow-hidden rounded-full border">
                      <Image
                        src={creator.image}
                        alt={creator.name || "Creator"}
                        fill
                        className="object-cover"
                      />
                    </div>
                  ) : (
                    <div className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-base font-semibold text-primary">
                      {(creator.name || "?").slice(0, 1).toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="truncate font-medium group-hover:text-primary">
                      {creator.name || "Anonymous Creator"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {creator.publicCharacterCount} character
                      {creator.publicCharacterCount !== 1 ? "s" : ""}
                    </p>
                  </div>
                </div>
                {creator.bio && (
                  <p className="mt-3 line-clamp-2 text-sm text-muted-foreground">{creator.bio}</p>
                )}
                <div className="mt-3 flex gap-4 text-xs text-muted-foreground">
                  <span>{creator.totalUsageCount.toLocaleString()} chats</span>
                  <span>{creator.totalLikeCount.toLocaleString()} likes</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {currentUser?.id && (
        <section>
          <div className="mb-4 flex items-center gap-2">
            <HiUserGroup className="size-5 text-primary" />
            <h2 className="text-xl font-semibold">From Creators You Follow</h2>
          </div>
          {followingCreatorIds.length === 0 ? (
            <div className="rounded-xl border border-dashed p-8 text-sm text-muted-foreground">
              Follow a few creators to see their newest characters here. Start with{" "}
              <Link href="/explore" className="text-primary underline-offset-4 hover:underline">
                Explore
              </Link>
              .
            </div>
          ) : followingCharacters.length === 0 ? (
            <div className="rounded-xl border border-dashed p-8 text-sm text-muted-foreground">
              No public characters from creators you follow yet.
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
              {followingCharacters.map((character) => (
                <CharacterCard key={character.id} character={character} />
              ))}
            </div>
          )}
        </section>
      )}

      <section>
        <div className="mb-4 flex items-center gap-2">
          <HiArrowTrendingUp className="size-5 text-orange-500" />
          <h2 className="text-xl font-semibold">Trending Right Now</h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {trendingCharacters.map((character) => (
            <CharacterCard key={character.id} character={character} />
          ))}
        </div>
      </section>

      <section>
        <div className="mb-4 flex items-center gap-2">
          <HiSparkles className="size-5 text-emerald-500" />
          <h2 className="text-xl font-semibold">Fresh Characters</h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {freshCharacters.map((character) => (
            <CharacterCard key={character.id} character={character} />
          ))}
        </div>
      </section>
    </section>
  )
}
