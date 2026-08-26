import Link from "next/link"

import { cn } from "@/app/lib/utils"
import { buttonVariants } from "@/app/components/ui/button"
import { Icons } from "@/app/components/icons"

import { featureCards, howItWorksSteps, modelCards } from "./home-data"
import { SectionLabel } from "./SectionLabel"

export function HowItWorksSection() {
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

export function FeaturesSection() {
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

export function ModelsSection() {
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

export function FinalCtaSection() {
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
