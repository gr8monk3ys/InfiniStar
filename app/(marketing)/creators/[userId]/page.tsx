import { cache, Suspense } from "react"
import { type Metadata } from "next"
import Image from "next/image"
import { notFound } from "next/navigation"
import { HiCalendar, HiChatBubbleLeftRight, HiGlobeAlt } from "react-icons/hi2"

import { siteConfig } from "@/config/site"
import { toMonthlyRecurringCents } from "@/app/lib/creator-monetization"
import { formatDate, formatNumber } from "@/app/lib/intl-format"
import prisma from "@/app/lib/prismadb"
import { buildCreatorJsonLd } from "@/app/lib/structured-data"
import { CreatorSupportCard } from "@/app/components/monetization/CreatorSupportCard"

import { CreatorCharacterGrid } from "./CreatorCharacterGrid"
import FollowCreatorButton from "./FollowCreatorButton"
import { MatureCreatorCharacters } from "./MatureCreatorCharacters"

/**
 * ISR. The page reads no request state, so the HTML is the same for every
 * visitor and can be cached for an hour. It used to call `getCurrentUser()`
 * for the mature-content filter and the viewer's follow/subscription rows,
 * which made `revalidate` a no-op.
 *
 * What was per-user moved to the client, resolved from `/api/auth/session`
 * after hydration:
 * - follow state and "this is you": `FollowCreatorButton`
 * - the viewer's own subscription: `CreatorSupportCard`
 * - mature characters in the grid: `MatureCreatorCharacters` via `actions.tsx`
 */
export const revalidate = 3600

// No ids are listed at build (the build has no database); each profile is
// rendered on first request and cached from then on.
export function generateStaticParams() {
  return []
}

// `generateMetadata` and the page both need the profile; one query per render.
const getCreatorProfile = cache((userId: string) =>
  prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      image: true,
      bio: true,
      website: true,
      createdAt: true,
      characters: {
        // The cached document is SFW for everyone; a viewer with the mature
        // preference gets the full grid from the client after hydration.
        where: { isPublic: true, isNsfw: false },
        orderBy: [{ usageCount: "desc" }, { createdAt: "desc" }],
        include: {
          createdBy: {
            select: { id: true, name: true, image: true },
          },
        },
      },
    },
  })
)

export async function generateMetadata({ params }: CreatorProfilePageProps): Promise<Metadata> {
  const { userId } = await params
  const creator = await getCreatorProfile(userId)
  if (!creator) return {}
  return {
    alternates: {
      canonical: `/creators/${userId}`,
    },
    title: `${creator.name} | InfiniStar Creator`,
    description: creator.bio || `Explore ${creator.name}'s AI characters on InfiniStar.`,
    openGraph: {
      title: `${creator.name} | InfiniStar Creator`,
      description: creator.bio || undefined,
      images: creator.image ? [{ url: creator.image }] : undefined,
    },
  }
}

interface CreatorProfilePageProps {
  params: Promise<{ userId: string }>
}

export default async function CreatorProfilePage({ params }: CreatorProfilePageProps) {
  const { userId } = await params

  // The profile and the numbers around it only need the id from the URL, so
  // they load in one round. A missing profile still 404s below.
  const [user, tips, subscriptions, followerCount, chatTotals] = await Promise.all([
    getCreatorProfile(userId),
    prisma.creatorTip.findMany({
      where: {
        creatorId: userId,
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
        creatorId: userId,
        status: "ACTIVE",
      },
      select: {
        amountCents: true,
        interval: true,
      },
      take: 500,
    }),
    prisma.userFollow.count({
      where: { followingId: userId },
    }),
    // Across every public character, mature ones included: an aggregate
    // reveals nothing and should not shrink for viewers who cannot see them.
    prisma.character.aggregate({
      where: { createdById: userId, isPublic: true },
      _sum: { usageCount: true },
    }),
  ])

  if (!user) notFound()

  const totalChats = chatTotals._sum.usageCount ?? 0

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

  const jsonLd = buildCreatorJsonLd(
    { id: user.id, name: user.name, bio: user.bio, image: user.image },
    siteConfig.url
  )

  return (
    <section className="container flex flex-col gap-8 py-10">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />
      {/* Profile Header */}
      <div className="flex flex-col items-center gap-4 text-center">
        {user.image ? (
          <div className="relative size-24 overflow-hidden rounded-full border-2">
            <Image
              src={user.image}
              alt={user.name || "Creator"}
              fill
              sizes="96px"
              className="object-cover"
            />
          </div>
        ) : (
          <div className="flex size-24 items-center justify-center rounded-full border-2 bg-primary/10 text-3xl font-bold text-primary">
            {(user.name || "?").slice(0, 1).toUpperCase()}
          </div>
        )}
        <div>
          <h1 className="break-words text-2xl font-bold">{user.name || "Anonymous"}</h1>
          {user.bio && (
            <p className="mt-1 max-w-lg break-words text-muted-foreground">{user.bio}</p>
          )}
        </div>
        <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm tabular-nums text-muted-foreground">
          <span className="flex items-center gap-1">
            <HiCalendar className="size-4" aria-hidden="true" />
            Joined {formatDate(user.createdAt, { month: "short", year: "numeric" })}
          </span>
          <span className="flex items-center gap-1">
            <HiChatBubbleLeftRight className="size-4" aria-hidden="true" />
            {formatNumber(totalChats)} total chats
          </span>
          <span className="flex items-center gap-1">
            <span className="size-4 rounded-full bg-primary/10" aria-hidden="true" />
            {formatNumber(followerCount)} follower{followerCount === 1 ? "" : "s"}
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
          initialFollowerCount={followerCount}
        />
      </div>

      {/* Characters Grid */}
      <MatureCreatorCharacters creatorId={user.id}>
        <CreatorCharacterGrid characters={user.characters} />
      </MatureCreatorCharacters>

      <Suspense fallback={<CreatorSupportCardFallback creatorName={user.name || "Creator"} />}>
        <CreatorSupportCard
          creatorId={user.id}
          creatorName={user.name || "Creator"}
          initialSummary={summary}
        />
      </Suspense>
    </section>
  )
}

function CreatorSupportCardFallback({ creatorName }: { creatorName: string }) {
  return (
    <div className="rounded-xl border bg-card p-6 shadow-sm">
      <h2 className="text-lg font-semibold">Support {creatorName}</h2>
      <p className="mt-2 text-sm text-muted-foreground">Loading creator support options…</p>
    </div>
  )
}
