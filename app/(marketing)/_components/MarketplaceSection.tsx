import Image from "next/image"
import Link from "next/link"
import { HiArrowRight, HiArrowTrendingUp, HiOutlineUsers } from "react-icons/hi2"

import { cn } from "@/app/lib/utils"
import { buttonVariants } from "@/app/components/ui/button"
import { PublicCharacterCard } from "@/app/components/characters/PublicCharacterCard"

import { starterArchetypes, type CreatorSpotlight, type MarketplaceSectionProps } from "./home-data"

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
          <div className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-base font-semibold text-primary">
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

export function MarketplaceSection({
  featuredCharacters,
  creatorSpotlights,
}: MarketplaceSectionProps) {
  const hasMarketplaceContent = featuredCharacters.length > 0 || creatorSpotlights.length > 0

  return (
    <section className="relative py-16 md:py-24">
      <div className="container max-w-6xl">
        <div className="mb-10 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="max-w-2xl">
            <h2 className="font-heading text-3xl font-bold tracking-tight [text-wrap:balance] md:text-4xl">
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
              <div className="flex items-center gap-2 text-sm font-medium text-primary-accent">
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
                <p className="text-xs font-medium uppercase tracking-[0.2em] text-primary-accent">
                  {archetype.category}
                </p>
                <h3 className="mt-4 font-heading text-xl font-semibold">{archetype.name}</h3>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                  {archetype.description}
                </p>
                <Link
                  href="/sign-up"
                  className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-foreground underline decoration-primary/40 underline-offset-4 transition-colors hover:text-primary"
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
