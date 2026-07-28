import Image from "next/image"
import Link from "next/link"
import {
  HiArrowRight,
  HiArrowTrendingUp,
  HiOutlineBolt,
  HiOutlineChatBubbleLeftRight,
  HiOutlineRocketLaunch,
  HiOutlineSparkles,
  HiOutlineUsers,
} from "react-icons/hi2"

import { CHARACTER_CATEGORIES } from "@/app/lib/character-categories"
import prisma from "@/app/lib/prismadb"
import { cn } from "@/app/lib/utils"
import { buttonVariants } from "@/app/components/ui/button"
import { PublicCharacterCard } from "@/app/components/characters/PublicCharacterCard"
import { Icons } from "@/app/components/icons"

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
] as const

const featureCards = [
  {
    number: "01",
    icon: HiOutlineSparkles,
    title: "Characters with a point of view",
    description:
      "Profiles, greetings, tags, and creator-defined tone give each character a stronger identity before the first reply.",
    wash: "from-violet-500/[0.08] to-transparent",
    iconColor: "text-violet-500",
  },
  {
    number: "02",
    icon: HiOutlineBolt,
    title: "Memory that keeps the thread",
    description:
      "Longer chats do not need to restart from zero. Save context, revisit favorites, and keep continuity over time.",
    wash: "from-fuchsia-500/[0.08] to-transparent",
    iconColor: "text-fuchsia-500",
  },
  {
    number: "03",
    icon: HiOutlineRocketLaunch,
    title: "Creator tools built into the platform",
    description:
      "Publish characters, earn support, and build an audience without stitching together a separate storefront.",
    wash: "from-amber-500/[0.08] to-transparent",
    iconColor: "text-amber-500",
  },
] as const

const howItWorksSteps = [
  {
    step: "1",
    title: "Find a character",
    description:
      "Browse the marketplace by category — romance, fantasy, anime, study help — or search for the exact vibe you want.",
  },
  {
    step: "2",
    title: "Start the conversation",
    description:
      "Every character opens with its own greeting and voice. Streaming replies, reactions, threads, and regenerate built in.",
  },
  {
    step: "3",
    title: "Make it yours",
    description:
      "Save memories, pin favorites, remix public characters, or publish your own and build an audience around it.",
  },
] as const

const modelCards = [
  {
    name: "Claude Sonnet 4.6",
    desc: "Balanced performance and speed",
    badge: "Recommended",
    badgeClass: "bg-violet-100 text-violet-800 dark:bg-violet-500/20 dark:text-violet-200",
  },
  {
    name: "Claude Haiku 4.5",
    desc: "Fastest responses, cost-efficient",
    badge: "Fast",
    badgeClass: "bg-blue-100 text-blue-800 dark:bg-blue-500/20 dark:text-blue-200",
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

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.24em] text-violet-700 dark:text-violet-300">
      <span className="h-px w-6 bg-current" aria-hidden="true" />
      {children}
    </p>
  )
}

function HeroChatPreview() {
  return (
    <div className="relative mx-auto w-full max-w-md" aria-hidden="true">
      <div className="absolute -inset-6 rounded-[2.5rem] bg-gradient-to-br from-violet-600/15 via-fuchsia-500/10 to-amber-500/10 blur-2xl" />

      <div className="glass relative rounded-3xl border border-border/60 p-5 shadow-2xl shadow-violet-950/10">
        <div className="flex items-center gap-3 border-b border-border/60 pb-4">
          <div className="gradient-bg flex size-11 shrink-0 items-center justify-center rounded-2xl text-white">
            <Icons.logo className="size-6" />
          </div>
          <div className="min-w-0">
            <p className="truncate font-heading font-semibold">Nyra, Starship Navigator</p>
            <p className="truncate text-xs text-muted-foreground">Sci-Fi · by @stellarforge</p>
          </div>
          <span className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-green-500/10 px-2.5 py-1 text-xs font-medium text-green-600 dark:text-green-400">
            <span className="size-1.5 rounded-full bg-current" />
            Live
          </span>
        </div>

        <div className="space-y-3 pt-4 text-sm leading-relaxed">
          <div className="chat-bubble-ai w-fit max-w-[85%] rounded-2xl rounded-tl-md px-4 py-2.5">
            The nav console just flagged an unmapped jump gate. Officially, we log it and move on.
            Unofficially… I already plotted a course. Your call, Captain.
          </div>
          <div className="chat-bubble-user ml-auto w-fit max-w-[85%] rounded-2xl rounded-tr-md px-4 py-2.5">
            How bad could one detour be?
          </div>
          <div className="chat-bubble-ai w-fit max-w-[85%] rounded-2xl rounded-tl-md px-4 py-2.5">
            Last time you said that, we adopted a smuggler and a cat. Setting course.
          </div>
          <div className="chat-bubble-ai flex w-fit items-center gap-1.5 rounded-2xl rounded-tl-md px-4 py-3">
            <span className="size-1.5 animate-typing-bounce rounded-full bg-current opacity-70" />
            <span
              className="size-1.5 animate-typing-bounce rounded-full bg-current opacity-70"
              style={{ animationDelay: "0.15s" }}
            />
            <span
              className="size-1.5 animate-typing-bounce rounded-full bg-current opacity-70"
              style={{ animationDelay: "0.3s" }}
            />
          </div>
        </div>
      </div>

      <div className="glass absolute -bottom-6 -left-4 hidden rounded-2xl border border-border/60 px-4 py-3 shadow-xl sm:block">
        <p className="text-xs font-medium text-muted-foreground">Memory saved</p>
        <p className="font-heading text-sm font-semibold">“Crew: one smuggler, one cat”</p>
      </div>
    </div>
  )
}

function CategoryMarquee() {
  // The list renders twice so the marquee loops seamlessly; the second copy is
  // decorative and hidden from assistive tech and keyboard navigation.
  const items = [
    ...CHARACTER_CATEGORIES.map((category) => ({ ...category, decorative: false })),
    ...CHARACTER_CATEGORIES.map((category) => ({ ...category, decorative: true })),
  ]

  return (
    <div className="relative border-y border-border/50 bg-background/60 py-4">
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-16 bg-gradient-to-r from-background to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-16 bg-gradient-to-l from-background to-transparent" />

      <div className="overflow-hidden">
        <div className="flex w-max animate-marquee gap-3 hover:[animation-play-state:paused] motion-reduce:w-full motion-reduce:animate-none motion-reduce:flex-wrap motion-reduce:justify-center">
          {items.map((category) => (
            <Link
              key={`${category.id}-${category.decorative ? "b" : "a"}`}
              href={`/explore?category=${category.id}`}
              className="inline-flex shrink-0 items-center gap-2 rounded-full border border-border/60 bg-card px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
              tabIndex={category.decorative ? -1 : undefined}
              aria-hidden={category.decorative ? "true" : undefined}
            >
              <span aria-hidden="true">{category.emoji}</span>
              {category.name}
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}

function HeroSection() {
  return (
    <section className="grain aurora-backdrop relative overflow-hidden">
      <div className="dot-grid pointer-events-none absolute inset-0 [mask-image:radial-gradient(60rem_40rem_at_50%_-10%,black,transparent)]" />

      <div className="container relative grid max-w-6xl items-center gap-12 pb-16 pt-14 md:pb-24 md:pt-20 lg:grid-cols-[1.05fr_0.95fr] lg:gap-8 lg:pb-28 lg:pt-24">
        <div className="flex flex-col items-start gap-6 text-left">
          <div className="inline-flex animate-fade-in-up items-center gap-2 rounded-full border border-violet-300/60 bg-violet-50/80 px-4 py-1.5 text-sm text-violet-800 dark:border-violet-400/30 dark:bg-violet-500/15 dark:text-violet-200">
            <HiOutlineSparkles className="size-4" aria-hidden="true" />
            <span>Creator-built character platform</span>
          </div>

          <h1 className="animate-fade-in-up font-heading text-5xl font-extrabold leading-[0.98] tracking-tight [text-wrap:balance] sm:text-6xl lg:text-7xl">
            Characters <span className="gradient-text">worth coming back</span> to
          </h1>

          <p className="max-w-xl text-lg leading-relaxed text-muted-foreground [text-wrap:pretty] sm:text-xl">
            Explore creator-made personalities for roleplay, romance, tutoring, and worldbuilding.
            Save favorites, keep context, and publish your own when you are ready.
          </p>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Link
              href="/sign-up"
              className={cn(
                buttonVariants({ variant: "default", size: "lg" }),
                "gradient-bg group h-12 gap-2 border-0 px-6 text-base text-white shadow-lg shadow-violet-500/25 hover:shadow-violet-500/40"
              )}
            >
              Create Free Account
              <HiArrowRight
                className="size-4 transition-transform group-hover:translate-x-0.5"
                aria-hidden="true"
              />
            </Link>
            <Link
              href="/explore"
              className={cn(
                buttonVariants({ variant: "outline", size: "lg" }),
                "h-12 gap-2 px-6 text-base"
              )}
            >
              <HiOutlineSparkles className="size-4" aria-hidden="true" />
              Explore Characters
            </Link>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
            <span className="flex items-center gap-2">
              <HiOutlineChatBubbleLeftRight className="size-4 text-primary" aria-hidden="true" />
              Free to start — 50 messages a month
            </span>
            <span className="flex items-center gap-2">
              <HiOutlineBolt className="size-4 text-amber-500" aria-hidden="true" />
              Powered by Claude
            </span>
          </div>
        </div>

        <HeroChatPreview />
      </div>

      <CategoryMarquee />
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
          <div className="flex size-12 items-center justify-center rounded-2xl bg-violet-100 text-base font-semibold text-violet-800 dark:bg-violet-500/20 dark:text-violet-200">
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
    <section className="relative py-16 md:py-24">
      <div className="container max-w-6xl">
        <div className="mb-10 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="max-w-2xl">
            <SectionLabel>From the marketplace</SectionLabel>
            <h2 className="mt-4 font-heading text-3xl font-bold tracking-tight [text-wrap:balance] md:text-4xl">
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
              <div className="flex items-center gap-2 text-sm font-medium text-violet-800 dark:text-violet-200">
                <HiArrowTrendingUp className="size-4" aria-hidden="true" />
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
                className="group relative overflow-hidden rounded-3xl border border-border/50 bg-card/70 p-6 shadow-sm transition-colors hover:border-primary/30"
              >
                <p className="text-xs font-medium uppercase tracking-[0.2em] text-violet-800 dark:text-violet-200">
                  {archetype.category}
                </p>
                <h3 className="mt-4 font-heading text-xl font-semibold">{archetype.name}</h3>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                  {archetype.description}
                </p>
                <Link
                  href="/sign-up"
                  className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-foreground underline decoration-violet-300 underline-offset-4 transition-colors hover:text-violet-700 dark:decoration-violet-400/50 dark:hover:text-violet-200"
                >
                  Start building this vibe
                  <HiArrowRight
                    className="size-3.5 transition-transform group-hover:translate-x-0.5"
                    aria-hidden="true"
                  />
                </Link>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}

function HowItWorksSection() {
  return (
    <section className="relative border-y border-border/50 bg-muted/30 py-16 md:py-24">
      <div className="container max-w-6xl">
        <div className="mb-12 max-w-2xl">
          <SectionLabel>How it works</SectionLabel>
          <h2 className="mt-4 font-heading text-3xl font-bold tracking-tight [text-wrap:balance] md:text-4xl">
            From first hello to your own front-page character
          </h2>
        </div>

        <ol className="grid gap-6 md:grid-cols-3">
          {howItWorksSteps.map((item) => (
            <li
              key={item.step}
              className="relative rounded-3xl border border-border/50 bg-background p-7"
            >
              <span
                className="gradient-text font-heading text-5xl font-extrabold"
                aria-hidden="true"
              >
                {item.step}
              </span>
              <h3 className="mt-4 font-heading text-xl font-semibold">{item.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                {item.description}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}

function FeaturesSection() {
  return (
    <section className="relative py-16 md:py-24">
      <div className="container max-w-6xl">
        <div className="mb-12 max-w-2xl">
          <SectionLabel>Why InfiniStar</SectionLabel>
          <h2 className="mt-4 font-heading text-3xl font-bold tracking-tight [text-wrap:balance] md:text-4xl">
            The goal is not “more AI.” It is a conversation you want to keep going.
          </h2>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {featureCards.map((feature) => (
            <div
              key={feature.title}
              className={cn(
                "group relative overflow-hidden rounded-3xl border border-border/50 p-8",
                "bg-gradient-to-br",
                feature.wash,
                "transition-[border-color,box-shadow] duration-300 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5"
              )}
            >
              <div className="flex items-start justify-between">
                <div className="inline-flex rounded-2xl bg-background/80 p-3 shadow-sm">
                  <feature.icon className={cn("size-7", feature.iconColor)} aria-hidden="true" />
                </div>
                <span
                  className="font-heading text-sm font-semibold text-muted-foreground/50"
                  aria-hidden="true"
                >
                  {feature.number}
                </span>
              </div>
              <h3 className="mb-3 mt-6 font-heading text-xl font-semibold">{feature.title}</h3>
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
    <section className="border-t border-border/50 py-16 md:py-24">
      <div className="container max-w-6xl">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <div>
            <SectionLabel>Models</SectionLabel>
            <h2 className="mt-4 font-heading text-3xl font-bold tracking-tight [text-wrap:balance] md:text-4xl">
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
                  className="flex items-center gap-4 rounded-2xl border border-border/50 bg-card p-4 transition-colors hover:border-primary/30"
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
            <div className="absolute -inset-4 rounded-3xl bg-gradient-to-br from-violet-600/10 via-fuchsia-500/10 to-amber-500/10 blur-2xl" />
            <div className="relative rounded-3xl border border-border/50 bg-card p-6 shadow-2xl">
              <div className="mb-4 flex items-center gap-3">
                <div className="gradient-bg flex size-10 items-center justify-center rounded-full text-white">
                  <Icons.logo className="size-5" aria-hidden="true" />
                </div>
                <div>
                  <div className="font-heading font-semibold">Creative AI</div>
                  <div className="text-xs text-muted-foreground">Claude Sonnet 4.6</div>
                </div>
              </div>
              <div className="space-y-3 text-sm">
                <div className="chat-bubble-user ml-auto w-fit rounded-2xl rounded-tr-md px-4 py-2.5">
                  Tell me about quantum computing
                </div>
                <div className="chat-bubble-ai w-fit rounded-2xl rounded-tl-md px-4 py-2.5">
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
    <section className="py-16 md:py-24">
      <div className="container max-w-6xl">
        <div className="grain aurora-backdrop relative overflow-hidden rounded-[2.5rem] border border-border/50 px-6 py-16 text-center md:px-16 md:py-20">
          <div className="relative mx-auto flex max-w-3xl flex-col items-center gap-6">
            <Icons.logo className="size-10 text-primary" aria-hidden="true" />
            <h2 className="font-heading text-4xl font-extrabold tracking-tight [text-wrap:balance] md:text-5xl">
              Ready to build a character people <span className="gradient-text">remember</span>?
            </h2>
            <p className="text-lg text-muted-foreground [text-wrap:pretty]">
              Create your account, explore what other creators are publishing, and put your own
              voice on the front page while the catalog is still early.
            </p>
            <div className="flex flex-col gap-4 sm:flex-row">
              <Link
                href="/sign-up"
                className={cn(
                  buttonVariants({ size: "lg" }),
                  "gradient-bg h-12 gap-2 border-0 px-6 text-base text-white shadow-lg shadow-violet-500/25"
                )}
              >
                Create Free Account
              </Link>
              <Link
                href="/explore"
                className={cn(
                  buttonVariants({ variant: "outline", size: "lg" }),
                  "h-12 px-6 text-base"
                )}
              >
                Explore Characters
              </Link>
            </div>
          </div>
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
      <HowItWorksSection />
      <FeaturesSection />
      <ModelsSection />
      <FinalCtaSection />
    </>
  )
}
