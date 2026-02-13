import Link from "next/link"
import {
  HiOutlineBolt,
  HiOutlineChatBubbleLeftRight,
  HiOutlineShieldCheck,
  HiOutlineSparkles,
} from "react-icons/hi2"

import { monetizationConfig } from "@/app/lib/monetization"
import { cn } from "@/app/lib/utils"
import { buttonVariants } from "@/app/components/ui/button"
import { AdSenseUnit } from "@/app/components/monetization/AdSenseUnit"
import { AffiliatePartnersSection } from "@/app/components/monetization/AffiliatePartnersSection"

export default async function IndexPage() {
  return (
    <>
      {/* Hero Section - Big impact, gradient glow background */}
      <section className="relative overflow-hidden pb-16 pt-12 md:pb-24 md:pt-20 lg:pb-32 lg:pt-28">
        {/* Background glow effects */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2">
            <div className="h-[600px] w-[600px] rounded-full bg-gradient-to-br from-violet-600/20 to-blue-500/20 blur-[120px]" />
          </div>
        </div>

        <div className="container relative flex max-w-5xl flex-col items-center gap-8 text-center">
          {/* Badge */}
          <div className="inline-flex animate-fade-in-up items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-sm text-primary">
            <HiOutlineSparkles className="size-4" />
            <span>Powered by Claude AI</span>
          </div>

          {/* Main headline */}
          <h1 className="font-heading animate-fade-in-up text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl lg:text-7xl">
            Chat with <span className="gradient-text">AI Characters</span>
            <br />
            That Feel Alive
          </h1>

          {/* Subtitle */}
          <p className="max-w-2xl animate-fade-in-up text-lg text-muted-foreground sm:text-xl">
            Create and chat with unique AI personalities. From helpful assistants to creative
            companions — powered by the most advanced AI models.
          </p>

          {/* CTA buttons */}
          <div className="flex animate-fade-in-up flex-col gap-4 sm:flex-row">
            <Link
              href="/sign-in"
              className={cn(
                buttonVariants({ variant: "default", size: "lg" }),
                "gradient-bg gap-2 border-0 text-white shadow-lg shadow-violet-500/25 hover:shadow-violet-500/40"
              )}
            >
              <HiOutlineChatBubbleLeftRight className="size-5" />
              Start Chatting Free
            </Link>
            <Link
              href="/explore"
              className={cn(buttonVariants({ variant: "outline", size: "lg" }), "gap-2")}
            >
              <HiOutlineSparkles className="size-5" />
              Explore Characters
            </Link>
          </div>

          {/* Trust badges */}
          <div className="mt-4 flex flex-wrap items-center justify-center gap-8 text-sm text-muted-foreground">
            <span className="flex items-center gap-2">
              <HiOutlineShieldCheck className="size-4 text-green-500" />
              No credit card required
            </span>
            <span className="flex items-center gap-2">
              <HiOutlineBolt className="size-4 text-yellow-500" />
              10 free messages/month
            </span>
            <span className="flex items-center gap-2">
              <HiOutlineSparkles className="size-4 text-primary" />
              All personalities included
            </span>
          </div>
        </div>
      </section>

      {/* Features Section - 3 large cards instead of 8 small ones */}
      <section className="relative border-y border-border/50 py-16 md:py-24">
        <div className="container max-w-6xl">
          <div className="mb-12 text-center">
            <h2 className="font-heading text-3xl font-bold md:text-4xl">
              Why Choose <span className="gradient-text">InfiniStar</span>
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">
              Everything you need for next-level AI conversations
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            {[
              {
                icon: HiOutlineSparkles,
                title: "Unique AI Personalities",
                description:
                  "Choose from 7 distinct personalities or create your own custom AI character with unique traits and conversation styles.",
                gradient: "from-violet-500/10 to-purple-500/10",
                iconColor: "text-violet-500",
              },
              {
                icon: HiOutlineBolt,
                title: "Smart Memory & Context",
                description:
                  "AI that remembers your conversations and builds context over time. Get smarter, more personalized responses.",
                gradient: "from-blue-500/10 to-cyan-500/10",
                iconColor: "text-blue-500",
              },
              {
                icon: HiOutlineShieldCheck,
                title: "Enterprise Security",
                description:
                  "2FA authentication, encrypted storage, CSRF protection, and rate limiting. Your data stays private and secure.",
                gradient: "from-green-500/10 to-emerald-500/10",
                iconColor: "text-green-500",
              },
            ].map((feature) => (
              <div
                key={feature.title}
                className={cn(
                  "group relative overflow-hidden rounded-2xl border border-border/50 p-8",
                  "bg-gradient-to-br",
                  feature.gradient,
                  "transition-all duration-300 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5"
                )}
              >
                <div className={cn("mb-4 inline-flex rounded-xl p-3", "bg-background/80")}>
                  <feature.icon className={cn("size-7", feature.iconColor)} />
                </div>
                <h3 className="mb-3 text-xl font-semibold">{feature.title}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* AI Models Section - Cleaner, more visual */}
      <section className="py-16 md:py-24">
        <div className="container max-w-6xl">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <div>
              <h2 className="font-heading text-3xl font-bold md:text-4xl">
                Powered by the Best <span className="gradient-text">AI Models</span>
              </h2>
              <p className="mt-4 text-lg text-muted-foreground">
                Choose the model that matches your needs. From lightning-fast responses to deep,
                nuanced conversations.
              </p>

              <div className="mt-8 space-y-4">
                {[
                  {
                    name: "Claude 3.5 Sonnet",
                    desc: "Balanced performance and speed",
                    badge: "Recommended",
                    badgeClass: "bg-primary/10 text-primary",
                  },
                  {
                    name: "Claude 3.5 Haiku",
                    desc: "Fastest responses, cost-efficient",
                    badge: "Fast",
                    badgeClass: "bg-blue-500/10 text-blue-500",
                  },
                  {
                    name: "Claude 3 Opus",
                    desc: "Most capable, complex reasoning",
                    badge: "Powerful",
                    badgeClass: "bg-amber-500/10 text-amber-500",
                  },
                ].map((model) => (
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

            {/* Mock chat preview */}
            <div className="relative">
              <div className="absolute -inset-4 rounded-3xl bg-gradient-to-br from-violet-600/10 to-blue-500/10 blur-2xl" />
              <div className="relative rounded-2xl border border-border/50 bg-card p-6 shadow-2xl">
                <div className="mb-4 flex items-center gap-3">
                  <div className="gradient-bg size-10 rounded-full" />
                  <div>
                    <div className="font-semibold">Creative AI</div>
                    <div className="text-xs text-muted-foreground">Claude 3.5 Sonnet</div>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="ml-auto w-fit rounded-2xl bg-primary px-4 py-2.5 text-sm text-white">
                    Tell me about quantum computing
                  </div>
                  <div className="surface-2 w-fit rounded-2xl px-4 py-2.5 text-sm">
                    Imagine quantum bits as tiny dancers on an infinite stage, able to perform
                    multiple moves simultaneously...
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <AffiliatePartnersSection sourcePage="homepage" />

      {monetizationConfig.enableAdSense && monetizationConfig.adSenseSlots.homeInline ? (
        <section className="container pb-8 md:pb-14">
          <div className="mx-auto max-w-4xl rounded-xl border border-border/50 bg-card/40 p-4 md:p-6">
            <p className="mb-3 text-xs uppercase tracking-wide text-muted-foreground">Sponsored</p>
            <AdSenseUnit slot={monetizationConfig.adSenseSlots.homeInline} />
          </div>
        </section>
      ) : null}

      {/* CTA Section */}
      <section className="relative overflow-hidden border-t border-border/50 py-16 md:py-24">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2">
            <div className="h-[400px] w-[400px] rounded-full bg-gradient-to-br from-violet-600/10 to-blue-500/10 blur-[100px]" />
          </div>
        </div>
        <div className="container relative flex max-w-3xl flex-col items-center gap-6 text-center">
          <h2 className="font-heading text-3xl font-bold md:text-4xl">
            Ready to Meet Your AI Companion?
          </h2>
          <p className="text-lg text-muted-foreground">
            Join thousands of users creating and chatting with unique AI characters. Start free,
            upgrade anytime.
          </p>
          <div className="flex flex-col gap-4 sm:flex-row">
            <Link
              href="/sign-in"
              className={cn(
                buttonVariants({ size: "lg" }),
                "gradient-bg gap-2 border-0 text-white shadow-lg shadow-violet-500/25"
              )}
            >
              Get Started Free
            </Link>
            <Link
              href="/pricing"
              className={cn(buttonVariants({ variant: "outline", size: "lg" }))}
            >
              View Pricing
            </Link>
          </div>
        </div>
      </section>
    </>
  )
}
