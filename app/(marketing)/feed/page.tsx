import Image from "next/image"
import Link from "next/link"
import { HiArrowTrendingUp, HiChatBubbleLeftRight, HiSparkles, HiUserGroup } from "react-icons/hi2"

import { CHARACTER_SELECT } from "@/app/lib/character-select"
import { canAccessNsfw } from "@/app/lib/nsfw"
import prisma from "@/app/lib/prismadb"
import { getRecommendationSignalsForUser, rankCharactersForUser } from "@/app/lib/recommendations"
import { cn } from "@/app/lib/utils"
import { buttonVariants } from "@/app/components/ui/button"
import getCurrentUser from "@/app/actions/getCurrentUser"
import { PublicCharacterCard } from "@/app/components/characters/PublicCharacterCard"
import { EmptySection } from "@/app/components/EmptySection"
import { RetryButton } from "@/app/components/RetryButton"

export const metadata = {
  title: "Community Feed | InfiniStar",
  description:
    "See trending characters, discover new creators, and follow what the InfiniStar community is building.",
  alternates: {
    canonical: "/feed",
  },
  openGraph: {
    title: "Community Feed | InfiniStar",
    description:
      "See trending characters, discover new creators, and follow what the InfiniStar community is building.",
  },
}

export const dynamic = "force-dynamic"

interface CreatorSummary {
  id: string
  name: string | null
  image: string | null
  bio: string | null
  publicCharacterCount: number
  totalUsageCount: number
  totalLikeCount: number
}

interface FeedCharacter {
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

interface FeedCreatorRow {
  id: string
  name: string | null
  image: string | null
  bio: string | null
  characters: Array<{ usageCount: number; likeCount: number }>
}

export default async function FeedPage() {
  const currentUser = await getCurrentUser()
  const allowNsfw = canAccessNsfw(currentUser)
  const publicCharacterWhere = allowNsfw ? { isPublic: true } : { isPublic: true, isNsfw: false }

  let trendingRaw: FeedCharacter[] = []
  let freshRaw: FeedCharacter[] = []
  let creatorRows: FeedCreatorRow[] = []
  let recommendationSignals = null
  let followingCreatorIds: string[] = []
  let followingRaw: FeedCharacter[] = []
  let feedError = false

  try {
    ;[trendingRaw, freshRaw, creatorRows] = await Promise.all([
      prisma.character.findMany({
        where: publicCharacterWhere,
        orderBy: [{ usageCount: "desc" }, { commentCount: "desc" }, { likeCount: "desc" }],
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

    recommendationSignals = currentUser?.id
      ? await getRecommendationSignalsForUser(currentUser.id)
      : null

    followingCreatorIds = currentUser?.id
      ? (
          await prisma.userFollow.findMany({
            where: { followerId: currentUser.id },
            select: { followingId: true },
            take: 1000,
          })
        ).map((row) => row.followingId)
      : []

    followingRaw =
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
  } catch (error) {
    // A failed query is not an empty community. Flag it so the page can say so
    // instead of rendering "nothing here yet" over what is actually an outage.
    feedError = true
    console.error("Failed to load feed page data", error)
  }

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
      <div className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-primary/5 via-background to-[hsl(var(--aurora-fuchsia)/0.05)] p-8 md:p-12">
        <div className="pointer-events-none absolute right-0 top-0 h-48 w-48 rounded-full bg-primary/10 blur-3xl" />
        <div className="relative max-w-3xl">
          <h1 className="text-3xl font-bold tracking-tight md:text-5xl">Creator Feed</h1>
          <p className="mt-3 max-w-2xl text-sm text-foreground/75 md:text-base">
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

      {feedError ? (
        <EmptySection
          variant="error"
          title="We couldn't load the feed right now"
          description={
            <>
              The community data didn't come back on this request. That is a fault on our side, not
              an empty community, so there is nothing here for you to fix. Try again in a moment, or
              browse the catalog directly while we recover.
            </>
          }
          action={
            <>
              <RetryButton />
              <Link
                href="/explore"
                className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
              >
                Browse Explore instead
              </Link>
            </>
          }
        />
      ) : (
        <>
          <section>
            <div className="mb-4 flex items-center gap-2">
              <HiUserGroup className="size-5 text-primary" />
              <h2 className="text-xl font-semibold">Top Creators</h2>
            </div>

            {topCreators.length === 0 ? (
              <EmptySection
                icon={HiUserGroup}
                title="No creators to rank yet"
                description="Creators land on this list once they publish a public character. Publish one and you put yourself here, at the top of an empty board."
                action={
                  <Link
                    href="/dashboard/characters/new"
                    className={cn(buttonVariants({ size: "sm" }))}
                  >
                    Create a character
                  </Link>
                }
              />
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
                            sizes="48px"
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
                      <p className="mt-3 line-clamp-2 text-sm text-muted-foreground">
                        {creator.bio}
                      </p>
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
                <EmptySection
                  icon={HiUserGroup}
                  title="You aren't following anyone yet"
                  description="Follow a creator and their newest public characters show up here before they reach anyone's Trending. Explore is the fastest place to find the first few."
                  action={
                    <Link href="/explore" className={cn(buttonVariants({ size: "sm" }))}>
                      Find creators to follow
                    </Link>
                  }
                />
              ) : followingCharacters.length === 0 ? (
                <EmptySection
                  icon={HiUserGroup}
                  title="Nothing new from the creators you follow"
                  description="The creators you follow haven't published a public character yet. Widen the net, or check back once they ship something."
                  action={
                    <Link
                      href="/explore"
                      className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
                    >
                      Follow a few more creators
                    </Link>
                  }
                />
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                  {followingCharacters.map((character) => (
                    <PublicCharacterCard key={character.id} character={character} />
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
            {trendingCharacters.length === 0 ? (
              <EmptySection
                icon={HiArrowTrendingUp}
                title="Nothing is trending yet"
                description="Trending ranks characters by how much the community actually chats with them, and no character has enough conversations behind it yet. The first one that catches on shows up here."
                action={
                  <>
                    <Link
                      href="/dashboard/characters/new"
                      className={cn(buttonVariants({ size: "sm" }))}
                    >
                      Create a character
                    </Link>
                    <Link
                      href="/explore"
                      className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
                    >
                      Browse the catalog
                    </Link>
                  </>
                }
              />
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                {trendingCharacters.map((character) => (
                  <PublicCharacterCard key={character.id} character={character} />
                ))}
              </div>
            )}
          </section>

          <section>
            <div className="mb-4 flex items-center gap-2">
              <HiSparkles className="size-5 text-emerald-500" />
              <h2 className="text-xl font-semibold">Fresh Characters</h2>
            </div>
            {freshCharacters.length === 0 ? (
              <EmptySection
                icon={HiSparkles}
                title="No characters have been published yet"
                description="Fresh shows the most recently published public characters, newest first. Nobody has published one yet, so the next character created lands at the top of this section on its own."
                action={
                  <>
                    <Link
                      href="/dashboard/characters/new"
                      className={cn(buttonVariants({ size: "sm" }))}
                    >
                      Publish the first character
                    </Link>
                    <Link
                      href="/explore"
                      className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
                    >
                      See how Explore works
                    </Link>
                  </>
                }
              />
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                {freshCharacters.map((character) => (
                  <PublicCharacterCard key={character.id} character={character} />
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </section>
  )
}
