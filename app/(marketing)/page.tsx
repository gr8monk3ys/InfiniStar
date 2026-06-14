import Image from "next/image"
import Link from "next/link"
import {
  HiArrowTrendingUp,
  HiOutlineBolt,
  HiOutlineChatBubbleLeftRight,
  HiOutlineShieldCheck,
  HiOutlineSquares2X2,
  HiOutlineUserCircle,
  HiOutlineUsers,
  HiOutlineWrenchScrewdriver,
} from "react-icons/hi2"

import prisma from "@/app/lib/prismadb"
import { cn } from "@/app/lib/utils"
import { buttonVariants } from "@/app/components/ui/button"
import { PublicCharacterCard } from "@/app/components/characters/PublicCharacterCard"

export const metadata = {
  title: "InfiniStar — Chat with AI Characters",
  description:
    "Chat with anime heroes, fantasy companions, and creative AI personalities. Powered by Claude.",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "InfiniStar — Chat with AI Characters",
    description: "Chat with anime heroes, fantasy companions, and creative AI personalities.",
    url: "/",
  },
}

const HOME_CHARACTER_SELECT = {
  id: true,
  slug: true,
  name: true,
  tagline: true,
  avatarUrl: true,
  category: true,
  usageCount: true,
  likeCount: true,
  commentCount: true,
  isNsfw: true,
  createdBy: {
    select: {
      id: true,
      name: true,
      image: true,
    },
  },
} as const

const starterArchetypes = [
  {
    name: "Late-Night Confidant",
    category: "Romance / Companion",
    description:
      "A warm, emotionally aware character for comfort, flirting, and long conversations that do not feel disposable.",
  },
  {
    name: "Questline Architect",
    category: "Fantasy / Roleplay",
    description:
      "A story-forward guide who can pull you into a world, keep the lore straight, and escalate tension scene by scene.",
  },
  {
    name: "Sharp Study Coach",
    category: "Education / Helper",
    description:
      "A tutor with enough backbone to challenge you, not just agree with every half-finished idea.",
  },
]

const featureCards = [
  {
    icon: HiOutlineUserCircle,
    title: "Characters with a point of view",
    description:
      "Profiles, greetings, tags, and creator-defined tone give each character a stronger identity before the first reply.",
    gradient: "from-rose-500/10 to-pink-500/10",
    iconColor: "text-rose-500",
  },
  {
    icon: HiOutlineBolt,
    title: "Memory that keeps the thread",
    description:
      "Longer chats do not need to restart from zero. Save context, revisit favorites, and keep continuity over time.",
    gradient: "from-amber-500/10 to-orange-500/10",
    iconColor: "text-amber-500",
  },
  {
    icon: HiOutlineWrenchScrewdriver,
    title: "Creator tools built into the platform",
    description:
      "Publish characters, earn support, and build an audience without stitching together a separate storefront.",
    gradient: "from-fuchsia-500/10 to-rose-500/10",
    iconColor: "text-fuchsia-500",
  },
] as const

const modelCards = [
  {
    name: "Claude Sonnet 4.6",
    desc: "Balanced performance and speed",
    badge: "Recommended",
    badgeClass: "bg-primary/10 text-primary dark:bg-primary/20",
  },
  {
    name: "Claude Haiku 4.5",
    desc: "Fastest responses, cost-efficient",
    badge: "Fast",
    badgeClass: "bg-secondary text-secondary-foreground",
  },
] as const

interface HomeCharacter {
  id: string
  slug: string
  name: string
  tagline: string | null
  avatarUrl: string | null
  category: string
  usageCount: number
  likeCount: number
  commentCount: number
  isNsfw: boolean
  createdBy: {
    id: string
    name: string | null
    image: string | null
  } | null
}

interface CreatorRow {
  id: string
  name: string | null
  image: string | null
  bio: string | null
  characters: Array<{ usageCount: number; likeCount: number }>
}

interface CreatorSpotlight {
  id: string
  name: string | null
  image: string | null
  bio: string | null
  publicCharacterCount: number
  totalUsageCount: number
  totalLikeCount: number
}

interface MarketplaceSectionProps {
  featuredCharacters: HomeCharacter[]
  creatorSpotlights: CreatorSpotlight[]
}

function HeroSection() {
  return (
    <section className="relative overflow-hidden pb-16 pt-12 md:pb-24 md:pt-20 lg:pb-32 lg:pt-28">
      <div className="container relative flex max-w-5xl flex-col items-center gap-8 text-center">
        <p className="text-xs font-medium uppercase tracking-[0.28em] text-muted-foreground">
          Creator-built character platform
        </p>

        <h1 className="font-heading text-4xl font-bold tracking-tight [text-wrap:balance] sm:text-5xl md:text-6xl lg:text-7xl">
          Find <span className="gradient-text">AI Characters</span>
          <br />
          Worth Coming Back To
        </h1>

        <p className="max-w-2xl text-lg text-muted-foreground [text-wrap:pretty] sm:text-xl">
          Explore creator-made personalities for roleplay, romance, tutoring, and worldbuilding.
          Save favorites, keep context, and publish your own when you are ready.
        </p>

        <div className="flex flex-col gap-4 sm:flex-row">
          <Link
            href="/sign-up"
            className={cn(buttonVariants({ variant: "gradient", size: "lg" }), "gap-2")}
          >
            Create Free Account
          </Link>
          <Link
            href="/explore"
            className={cn(buttonVariants({ variant: "outline", size: "lg" }), "gap-2")}
          >
            <HiOutlineSquares2X2 className="size-5" aria-hidden="true" />
            Explore Characters
          </Link>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-center gap-8 text-sm text-muted-foreground">
          <span className="flex items-center gap-2">
            <HiOutlineChatBubbleLeftRight className="size-4 text-primary" aria-hidden="true" />
            Browse creator-made characters
          </span>
          <span className="flex items-center gap-2">
            <HiOutlineBolt className="size-4 text-yellow-500" aria-hidden="true" />
            Keep memory and context in the thread
          </span>
          <span className="flex items-center gap-2">
            <HiOutlineShieldCheck className="size-4 text-green-500" aria-hidden="true" />
            Publish and monetize your own
          </span>
        </div>
      </div>
    </section>
  )
}

function CreatorSpotlightCard({ creator }: { creator: CreatorSpotlight }) {
  return (
    <Link
      href={`/creators/${creator.id}`}
      className="group block rounded-2xl border border-border/60 bg-background/80 p-4 transition-colors hover:border-primary/30 hover:bg-accent/20"
    >
      <div className="flex items-center gap-3">
        {creator.image ? (
          <div className="relative size-12 overflow-hidden rounded-2xl border border-border/60">
            <Image
              src={creator.image}
              alt={creator.name || "Creator"}
              fill
              sizes="48px"
              className="object-cover"
            />
          </div>
        ) : (
          <div className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-base font-semibold text-primary dark:bg-primary/20">
            {(creator.name || "?").slice(0, 1).toUpperCase()}
          </div>
        )}
        <div className="min-w-0">
          <p className="truncate font-semibold group-hover:text-primary">
            {creator.name || "Anonymous Creator"}
          </p>
          <p className="text-xs text-muted-foreground">
            {creator.publicCharacterCount} public character
            {creator.publicCharacterCount !== 1 ? "s" : ""}
          </p>
        </div>
      </div>
      {creator.bio ? (
        <p className="mt-3 line-clamp-2 text-sm text-muted-foreground">{creator.bio}</p>
      ) : null}
      <div className="mt-4 flex gap-4 text-xs text-muted-foreground">
        <span>{creator.totalUsageCount.toLocaleString()} chats</span>
        <span>{creator.totalLikeCount.toLocaleString()} likes</span>
      </div>
    </Link>
  )
}

function MarketplaceSection({ featuredCharacters, creatorSpotlights }: MarketplaceSectionProps) {
  const hasMarketplaceContent = featuredCharacters.length > 0 || creatorSpotlights.length > 0

  return (
    <section className="relative border-y border-border/50 py-16 md:py-24">
      <div className="container max-w-6xl">
        <div className="mb-10 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-medium uppercase tracking-[0.2em] text-primary dark:border-primary/30 dark:bg-primary/10">
              <HiArrowTrendingUp className="size-4" aria-hidden="true" />
              What the product actually feels like
            </div>
            <h2 className="font-heading mt-4 text-3xl font-bold [text-wrap:balance] md:text-4xl">
              Start with something specific, not a blank prompt
            </h2>
            <p className="mt-3 text-lg text-muted-foreground [text-wrap:pretty]">
              The best public characters feel authored. If the marketplace is still warming up, use
              these starter lanes as the kind of experience InfiniStar is built for.
            </p>
          </div>

          <Link href="/feed" className={cn(buttonVariants({ variant: "outline" }), "w-fit gap-2")}>
            <HiOutlineUsers className="size-4" aria-hidden="true" />
            Visit Creator Feed
          </Link>
        </div>

        {hasMarketplaceContent ? (
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1.35fr)_minmax(18rem,0.85fr)]">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {featuredCharacters.map((character, index) => (
                <PublicCharacterCard
                  key={character.id}
                  character={character}
                  imagePriority={index === 0}
                />
              ))}
            </div>

            <div className="rounded-3xl border border-border/50 bg-card/70 p-6 shadow-sm">
              <div className="flex items-center gap-2 text-sm font-medium text-primary">
                <HiOutlineUsers className="size-4" aria-hidden="true" />
                Creator spotlights
              </div>
              <div className="mt-6 space-y-4">
                {creatorSpotlights.map((creator) => (
                  <CreatorSpotlightCard key={creator.id} creator={creator} />
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-3">
            {starterArchetypes.map((archetype) => (
              <article
                key={archetype.name}
                className="rounded-3xl border border-border/50 bg-card/70 p-6 shadow-sm"
              >
                <p className="text-xs font-medium uppercase tracking-[0.2em] text-primary">
                  {archetype.category}
                </p>
                <h3 className="mt-4 text-xl font-semibold">{archetype.name}</h3>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                  {archetype.description}
                </p>
                <Link
                  href="/sign-up"
                  className={cn(
                    buttonVariants({ variant: "ghost" }),
                    "mt-6 px-0 font-semibold text-foreground underline decoration-primary/40 underline-offset-4 hover:text-primary"
                  )}
                >
                  Start building this vibe
                </Link>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}

function FeaturesSection() {
  return (
    <section className="relative py-16 md:py-24">
      <div className="container max-w-6xl">
        <div className="mb-12 text-center">
          <h2 className="font-heading text-3xl font-bold [text-wrap:balance] md:text-4xl">
            Why the product feels more intentional
          </h2>
          <p className="mt-4 text-lg text-muted-foreground [text-wrap:pretty]">
            The goal is not “more AI.” The goal is a conversation you actually want to keep going.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {featureCards.map((feature) => (
            <div
              key={feature.title}
              className={cn(
                "group relative overflow-hidden rounded-2xl border border-border/50 p-8",
                "bg-gradient-to-br",
                feature.gradient,
                "transition-[border-color,box-shadow,transform] duration-300 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5"
              )}
            >
              <div className={cn("mb-4 inline-flex rounded-xl p-3", "bg-background/80")}>
                <feature.icon className={cn("size-7", feature.iconColor)} aria-hidden="true" />
              </div>
              <h3 className="mb-3 text-xl font-semibold">{feature.title}</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function ModelsSection() {
  return (
    <section className="py-16 md:py-24">
      <div className="container max-w-6xl">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <div>
            <h2 className="font-heading text-3xl font-bold [text-wrap:balance] md:text-4xl">
              Fast when you want it, deeper when you need it
            </h2>
            <p className="mt-4 text-lg text-muted-foreground [text-wrap:pretty]">
              Choose a lightweight model for speed or step up when you want longer, more nuanced
              character responses.
            </p>

            <div className="mt-8 space-y-4">
              {modelCards.map((model) => (
                <div
                  key={model.name}
                  className="flex items-center gap-4 rounded-xl border border-border/50 bg-card p-4 transition-colors hover:border-primary/30"
                >
                  <div
                    className={cn(
                      "shrink-0 rounded-lg px-2.5 py-1 text-xs font-medium",
                      model.badgeClass
                    )}
                  >
                    {model.badge}
                  </div>
                  <div>
                    <div className="font-semibold">{model.name}</div>
                    <div className="text-sm text-muted-foreground">{model.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="relative">
            <div className="relative rounded-2xl border border-border/50 bg-card p-6 shadow-xl">
              <div className="mb-4 flex items-center gap-3">
                <div className="gradient-bg size-10 rounded-full" />
                <div>
                  <div className="font-semibold">Creative AI</div>
                  <div className="text-xs text-muted-foreground">Claude Sonnet 4.6</div>
                </div>
              </div>
              <div className="space-y-3">
                <div className="ml-auto w-fit rounded-2xl bg-primary px-4 py-2.5 text-sm text-primary-foreground">
                  Tell me about quantum computing
                </div>
                <div className="surface-2 w-fit rounded-2xl px-4 py-2.5 text-sm">
                  Imagine quantum bits as tiny dancers on an infinite stage, able to perform
                  multiple moves simultaneously…
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

function FinalCtaSection() {
  return (
    <section className="relative overflow-hidden border-t border-border/50 py-16 md:py-24">
      <div className="container relative flex max-w-3xl flex-col items-center gap-6 text-center">
        <h2 className="font-heading text-3xl font-bold [text-wrap:balance] md:text-4xl">
          Ready to build a character people remember?
        </h2>
        <p className="text-lg text-muted-foreground [text-wrap:pretty]">
          Create your account, explore what other creators are publishing, and put your own voice on
          the front page while the catalog is still early.
        </p>
        <div className="flex flex-col gap-4 sm:flex-row">
          <Link
            href="/sign-up"
            className={cn(buttonVariants({ variant: "gradient", size: "lg" }), "gap-2")}
          >
            Create Free Account
          </Link>
          <Link href="/explore" className={cn(buttonVariants({ variant: "outline", size: "lg" }))}>
            Explore Characters
          </Link>
        </div>
      </div>
    </section>
  )
}

export default async function IndexPage() {
  let featuredCharacters: HomeCharacter[] = []
  let creatorRows: CreatorRow[] = []

  try {
    ;[featuredCharacters, creatorRows] = await Promise.all([
      prisma.character.findMany({
        where: { isPublic: true, isNsfw: false },
        orderBy: [{ featured: "desc" }, { usageCount: "desc" }, { createdAt: "desc" }],
        take: 3,
        select: HOME_CHARACTER_SELECT,
      }),
      prisma.user.findMany({
        where: {
          characters: {
            some: { isPublic: true, isNsfw: false },
          },
        },
        select: {
          id: true,
          name: true,
          image: true,
          bio: true,
          characters: {
            where: { isPublic: true, isNsfw: false },
            select: { usageCount: true, likeCount: true },
          },
        },
        take: 12,
      }),
    ])
  } catch (error) {
    console.error("Failed to load homepage marketplace data", error)
  }

  const creatorSpotlights = creatorRows
    .map((creator) => {
      const publicCharacterCount = creator.characters.length
      const totalUsageCount = creator.characters.reduce(
        (sum, character) => sum + character.usageCount,
        0
      )
      const totalLikeCount = creator.characters.reduce(
        (sum, character) => sum + character.likeCount,
        0
      )

      return {
        id: creator.id,
        name: creator.name,
        image: creator.image,
        bio: creator.bio,
        publicCharacterCount,
        totalUsageCount,
        totalLikeCount,
      }
    })
    .sort((a, b) => b.totalUsageCount - a.totalUsageCount)
    .slice(0, 3)

  return (
    <>
      <HeroSection />
      <MarketplaceSection
        featuredCharacters={featuredCharacters}
        creatorSpotlights={creatorSpotlights}
      />
      <FeaturesSection />
      <ModelsSection />
      <FinalCtaSection />
    </>
  )
}
