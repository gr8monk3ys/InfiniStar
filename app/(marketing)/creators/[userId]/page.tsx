import Image from "next/image"
import { notFound } from "next/navigation"
import { auth } from "@clerk/nextjs/server"
import { format } from "date-fns"
import { HiCalendar, HiChatBubbleLeftRight, HiGlobeAlt } from "react-icons/hi2"

import { toMonthlyRecurringCents } from "@/app/lib/creator-monetization"
import { canAccessNsfw } from "@/app/lib/nsfw"
import prisma from "@/app/lib/prismadb"
import { CharacterCard } from "@/app/components/characters/CharacterCard"
import { CreatorSupportCard } from "@/app/components/monetization/CreatorSupportCard"

import FollowCreatorButton from "./FollowCreatorButton"

export const dynamic = "force-dynamic"

interface CreatorCharacter {
  id: string
  slug: string
  name: string
  tagline: string | null
  avatarUrl: string | null
  category: string
  usageCount: number
  likeCount: number
  isNsfw?: boolean
  createdBy: {
    id: string
    name: string | null
    image: string | null
  } | null
}

interface CreatorProfilePageProps {
  params: Promise<{ userId: string }>
}

export default async function CreatorProfilePage({ params }: CreatorProfilePageProps) {
  const { userId } = await params

  const { userId: viewerClerkId } = await auth()
  const viewerUser = viewerClerkId
    ? await prisma.user.findUnique({
        where: { clerkId: viewerClerkId },
        select: { id: true, isAdult: true, nsfwEnabled: true },
      })
    : null
  const allowNsfw = canAccessNsfw(viewerUser)
  const publicCharacterWhere = allowNsfw ? { isPublic: true } : { isPublic: true, isNsfw: false }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      image: true,
      bio: true,
      website: true,
      createdAt: true,
      characters: {
        where: publicCharacterWhere,
        orderBy: [{ usageCount: "desc" }, { createdAt: "desc" }],
        include: {
          createdBy: {
            select: { id: true, name: true, image: true },
          },
        },
      },
    },
  })

  if (!user) notFound()

  const [tips, subscriptions, viewerSubscription, followerCount, viewerFollow] = await Promise.all([
    prisma.creatorTip.findMany({
      where: {
        creatorId: user.id,
        status: "COMPLETED",
      },
      select: {
        amountCents: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 500,
    }),
    prisma.creatorSubscription.findMany({
      where: {
        creatorId: user.id,
        status: "ACTIVE",
      },
      select: {
        amountCents: true,
        interval: true,
      },
      take: 500,
    }),
    viewerUser?.id
      ? prisma.creatorSubscription.findUnique({
          where: {
            supporterId_creatorId: {
              supporterId: viewerUser.id,
              creatorId: user.id,
            },
          },
          select: {
            id: true,
            tierName: true,
            amountCents: true,
            interval: true,
            status: true,
          },
        })
      : Promise.resolve(null),
    prisma.userFollow.count({
      where: { followingId: user.id },
    }),
    viewerUser?.id
      ? prisma.userFollow.findUnique({
          where: {
            followerId_followingId: {
              followerId: viewerUser.id,
              followingId: user.id,
            },
          },
          select: { followerId: true },
        })
      : Promise.resolve(null),
  ])

  const totalChats = user.characters.reduce(
    (sum: number, c: { usageCount: number }) => sum + c.usageCount,
    0
  )

  const summary = {
    tipCount: tips.length,
    tipsTotalCents: tips.reduce((sum, tip) => sum + tip.amountCents, 0),
    activeSubscriberCount: subscriptions.length,
    monthlyRecurringCents: subscriptions.reduce(
      (sum, subscription) =>
        sum + toMonthlyRecurringCents(subscription.amountCents, subscription.interval),
      0
    ),
    recentTipCount30d: tips.filter(
      (tip) => Date.now() - new Date(tip.createdAt).getTime() <= 30 * 24 * 60 * 60 * 1000
    ).length,
  }

  return (
    <section className="container flex flex-col gap-8 py-10">
      {/* Profile Header */}
      <div className="flex flex-col items-center gap-4 text-center">
        {user.image ? (
          <div className="relative size-24 overflow-hidden rounded-full border-2">
            <Image src={user.image} alt={user.name || "Creator"} fill className="object-cover" />
          </div>
        ) : (
          <div className="flex size-24 items-center justify-center rounded-full border-2 bg-primary/10 text-3xl font-bold text-primary">
            {(user.name || "?").slice(0, 1).toUpperCase()}
          </div>
        )}
        <div>
          <h1 className="text-2xl font-bold">{user.name || "Anonymous"}</h1>
          {user.bio && <p className="mt-1 max-w-lg text-muted-foreground">{user.bio}</p>}
        </div>
        <div className="flex items-center gap-6 text-sm text-muted-foreground">
          <span className="flex items-center gap-1">
            <HiCalendar className="size-4" aria-hidden="true" />
            Joined {format(new Date(user.createdAt), "MMM yyyy")}
          </span>
          <span className="flex items-center gap-1">
            <HiChatBubbleLeftRight className="size-4" aria-hidden="true" />
            {totalChats.toLocaleString()} total chats
          </span>
          <span className="flex items-center gap-1">
            <span className="size-4 rounded-full bg-primary/10" aria-hidden="true" />
            {followerCount.toLocaleString()} follower{followerCount === 1 ? "" : "s"}
          </span>
          {user.website && (
            <a
              href={user.website}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-primary hover:underline"
            >
              <HiGlobeAlt className="size-4" aria-hidden="true" />
              Website
            </a>
          )}
        </div>

        <FollowCreatorButton
          creatorId={user.id}
          creatorName={user.name || "Creator"}
          initialIsFollowing={Boolean(viewerFollow)}
          initialFollowerCount={followerCount}
          disabled={viewerUser?.id === user.id}
        />
      </div>

      {/* Characters Grid */}
      <div>
        <h2 className="mb-4 text-lg font-semibold">Characters ({user.characters.length})</h2>
        {user.characters.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-12 text-center">
            <p className="text-sm text-muted-foreground">No public characters yet.</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {user.characters.map((character: CreatorCharacter) => (
              <CharacterCard key={character.id} character={character} />
            ))}
          </div>
        )}
      </div>

      <CreatorSupportCard
        creatorId={user.id}
        creatorName={user.name || "Creator"}
        initialSummary={summary}
        initialViewerSubscription={viewerSubscription}
      />
    </section>
  )
}
