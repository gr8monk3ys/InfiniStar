import Link from "next/link"
import { auth } from "@clerk/nextjs/server"
import { HiCheck, HiOutlineSparkles } from "react-icons/hi2"

import { freePlan, proPlan } from "@/config/subscriptions"
import { monetizationConfig } from "@/app/lib/monetization"
import prisma from "@/app/lib/prismadb"
import { getUserSubscriptionPlan } from "@/app/lib/subscription"
import { cn } from "@/app/lib/utils"
import { buttonVariants } from "@/app/components/ui/button"
import { PricingCtaButton } from "@/app/(marketing)/pricing/PricingCtaButton"
import { AdSenseUnit } from "@/app/components/monetization/AdSenseUnit"
import { AffiliatePartnersSection } from "@/app/components/monetization/AffiliatePartnersSection"

export const metadata = {
  title: "Pricing | InfiniStar",
  description: "Simple, transparent pricing for AI conversations",
}

export default async function PricingPage() {
  const { userId } = await auth()
  const isSignedIn = Boolean(userId)

  let isPro = false

  if (userId) {
    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
      select: { id: true },
    })

    if (user) {
      const plan = await getUserSubscriptionPlan(user.id)
      isPro = plan.isPro
    }
  }

  return (
    <section className="container flex flex-col gap-8 py-8 md:max-w-6xl md:py-12 lg:py-24">
      {/* Header */}
      <div className="mx-auto flex w-full flex-col gap-4 text-center md:max-w-3xl">
        <h1 className="font-heading text-3xl font-bold leading-[1.1] sm:text-4xl md:text-5xl">
          Simple, Transparent Pricing
        </h1>
        <p className="text-lg leading-normal text-muted-foreground sm:text-xl">
          Start free with 10 messages per month. Upgrade to PRO for unlimited AI conversations.
        </p>
      </div>

      {/* Pricing Cards */}
      <div className="mx-auto grid w-full max-w-4xl gap-8 md:grid-cols-2">
        {/* Free Plan */}
        <div className="relative flex flex-col rounded-xl border bg-background p-8">
          <div className="mb-6">
            <h2 className="text-2xl font-bold">{freePlan.name}</h2>
            <p className="mt-2 text-sm text-muted-foreground">{freePlan.description}</p>
          </div>

          <div className="mb-6">
            <div className="flex items-baseline gap-1">
              <span className="text-5xl font-bold">${freePlan.price}</span>
              <span className="text-muted-foreground">/month</span>
            </div>
          </div>

          <ul className="mb-8 grow space-y-3">
            {freePlan.features.map((feature) => (
              <li key={feature} className="flex items-start gap-3 text-sm">
                <HiCheck className="mt-0.5 size-5 shrink-0 text-green-500" />
                <span>{feature}</span>
              </li>
            ))}
          </ul>

          <Link
            href={isSignedIn ? "/dashboard" : "/sign-in"}
            className={cn(buttonVariants({ variant: "outline", size: "lg" }), "w-full")}
          >
            {isSignedIn ? "Go to Dashboard" : "Get Started Free"}
          </Link>
        </div>

        {/* PRO Plan */}
        <div className="glow-sm relative flex flex-col rounded-xl border-2 border-primary bg-background p-8 shadow-lg">
          <div className="absolute -top-4 left-1/2 -translate-x-1/2">
            <span className="gradient-bg inline-flex items-center gap-1 rounded-full px-4 py-1 text-sm font-medium text-white">
              <HiOutlineSparkles className="size-4" />
              Most Popular
            </span>
          </div>

          <div className="mb-6">
            <h2 className="text-2xl font-bold">{proPlan.name}</h2>
            <p className="mt-2 text-sm text-muted-foreground">{proPlan.description}</p>
          </div>

          <div className="mb-6">
            <div className="flex items-baseline gap-1">
              <span className="text-5xl font-bold">${proPlan.price}</span>
              <span className="text-muted-foreground">/month</span>
            </div>
          </div>

          <ul className="mb-8 grow space-y-3">
            {proPlan.features.map((feature) => (
              <li key={feature} className="flex items-start gap-3 text-sm">
                <HiCheck className="mt-0.5 size-5 shrink-0 text-primary" />
                <span>{feature}</span>
              </li>
            ))}
          </ul>

          <PricingCtaButton
            isSignedIn={isSignedIn}
            isPro={isPro}
            className={cn(
              "gradient-bg w-full gap-2 border-0 text-white shadow-lg shadow-violet-500/25"
            )}
          />
        </div>
      </div>

      {monetizationConfig.enableAdSense && monetizationConfig.adSenseSlots.pricingInline ? (
        <div className="mx-auto w-full max-w-4xl rounded-xl border border-border/50 bg-card/40 p-4 md:p-6">
          <p className="mb-3 text-xs uppercase tracking-wide text-muted-foreground">Sponsored</p>
          <AdSenseUnit slot={monetizationConfig.adSenseSlots.pricingInline} />
        </div>
      ) : null}

      <AffiliatePartnersSection sourcePage="pricing" />

      {/* FAQ Section */}
      <div className="mx-auto mt-8 w-full max-w-3xl">
        <h2 className="mb-8 text-center text-2xl font-bold">Frequently Asked Questions</h2>

        <div className="space-y-6">
          <div className="rounded-lg border bg-background p-6">
            <h3 className="font-semibold">What counts as an AI message?</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Each message you send to the AI that receives a response counts as one message. System
              messages, conversation management, and searching don&apos;t count toward your limit.
            </p>
          </div>

          <div className="rounded-lg border bg-background p-6">
            <h3 className="font-semibold">Can I switch plans anytime?</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Yes! You can upgrade to PRO anytime and your billing will be prorated. You can also
              downgrade at the end of your billing period.
            </p>
          </div>

          <div className="rounded-lg border bg-background p-6">
            <h3 className="font-semibold">What AI models can I use?</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Free users have access to Claude 3.5 Sonnet. PRO users can choose from Claude 3.5
              Sonnet, Claude 3.5 Haiku (fastest), and Claude 3 Opus (most capable).
            </p>
          </div>

          <div className="rounded-lg border bg-background p-6">
            <h3 className="font-semibold">What are AI memories?</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              AI memories allow the assistant to remember important information across
              conversations. Free users get 50 memories, PRO users get 200. You can manage and
              delete memories at any time.
            </p>
          </div>

          <div className="rounded-lg border bg-background p-6">
            <h3 className="font-semibold">Is my data secure?</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Absolutely. We use enterprise-grade security including two-factor authentication,
              encrypted storage, CSRF protection, and rate limiting. Your conversations are private
              and encrypted.
            </p>
          </div>

          <div className="rounded-lg border bg-background p-6">
            <h3 className="font-semibold">What payment methods do you accept?</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              We accept all major credit cards (Visa, Mastercard, American Express) through Stripe.
              All payments are processed securely.
            </p>
          </div>
        </div>
      </div>

      {/* CTA */}
      <div className="mx-auto mt-8 text-center">
        <p className="text-muted-foreground">
          Questions? Check out our{" "}
          <Link href="/privacy" className="text-primary underline underline-offset-4">
            privacy policy
          </Link>{" "}
          or{" "}
          <Link href="/explore" className="text-primary underline underline-offset-4">
            explore features
          </Link>
          .
        </p>
      </div>
    </section>
  )
}
