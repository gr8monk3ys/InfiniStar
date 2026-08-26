import Link from "next/link"
import {
  HiArrowRight,
  HiOutlineBolt,
  HiOutlineChatBubbleLeftRight,
  HiOutlineSparkles,
} from "react-icons/hi2"

import { CHARACTER_CATEGORIES } from "@/app/lib/character-categories"
import { cn } from "@/app/lib/utils"
import { buttonVariants } from "@/app/components/ui/button"
import { Icons } from "@/app/components/icons"

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

export function HeroSection() {
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
