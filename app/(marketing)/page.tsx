import Link from "next/link"
import {
  HiOutlineArchiveBox,
  HiOutlineBolt,
  HiOutlineChartBar,
  HiOutlineChatBubbleLeftRight,
  HiOutlineMagnifyingGlass,
  HiOutlineShieldCheck,
  HiOutlineSparkles,
  HiOutlineUserGroup,
} from "react-icons/hi2"

import { siteConfig } from "@/config/site"
import { cn } from "@/app/lib/utils"
import { buttonVariants } from "@/app/components/ui/button"

const features = [
  {
    icon: HiOutlineSparkles,
    title: "Multiple AI Personalities",
    description:
      "Choose from 7 distinct personalities: helpful, concise, creative, analytical, empathetic, professional, or create your own custom persona.",
  },
  {
    icon: HiOutlineChatBubbleLeftRight,
    title: "Real-Time Conversations",
    description:
      "Engage in seamless, streaming AI conversations with support for message editing, reactions, and threading.",
  },
  {
    icon: HiOutlineShieldCheck,
    title: "Enterprise Security",
    description:
      "Two-factor authentication, encrypted data storage, CSRF protection, rate limiting, and comprehensive session management.",
  },
  {
    icon: HiOutlineBolt,
    title: "Smart AI Features",
    description:
      "AI-powered suggestions, conversation summaries, memory system for context retention, and intelligent auto-complete.",
  },
  {
    icon: HiOutlineUserGroup,
    title: "Collaboration & Sharing",
    description:
      "Share conversations via secure links, collaborate with permission controls, and export in multiple formats.",
  },
  {
    icon: HiOutlineChartBar,
    title: "Usage Analytics",
    description:
      "Track your AI usage with detailed dashboards, token analytics, cost estimates, and activity heatmaps.",
  },
  {
    icon: HiOutlineArchiveBox,
    title: "Smart Organization",
    description:
      "Tag, archive, pin, and auto-delete conversations. Keep your workspace organized with powerful management tools.",
  },
  {
    icon: HiOutlineMagnifyingGlass,
    title: "Advanced Search",
    description:
      "Full-text search across all conversations with filters, faceted results, and intelligent suggestions.",
  },
]

const aiModels = [
  {
    name: "Claude 3.5 Sonnet",
    description: "Balanced performance and speed",
    badge: "Recommended",
  },
  {
    name: "Claude 3.5 Haiku",
    description: "Fastest responses, cost-efficient",
    badge: "Fast",
  },
  {
    name: "Claude 3 Opus",
    description: "Most capable, complex reasoning",
    badge: "Powerful",
  },
]

export default async function IndexPage() {
  return (
    <>
      {/* Hero Section */}
      <section className="relative overflow-hidden pb-8 pt-6 md:pb-12 md:pt-10 lg:py-32">
        <div className="container flex max-w-6xl flex-col items-center gap-6 text-center">
          <div className="flex items-center gap-2 rounded-full border border-border bg-muted/50 px-4 py-1.5 text-sm text-muted-foreground">
            <HiOutlineSparkles className="size-4 text-primary" />
            <span>Powered by Claude AI</span>
          </div>

          <h1 className="font-heading text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl lg:text-7xl">
            Your Intelligent{" "}
            <span className="bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
              AI Companion
            </span>
          </h1>

          <p className="max-w-3xl text-lg leading-normal text-muted-foreground sm:text-xl sm:leading-8">
            InfiniStar brings you advanced AI conversations with multiple personalities, real-time
            streaming, smart memory, and enterprise-grade security. Experience the future of AI
            interaction.
          </p>

          <div className="flex flex-col gap-4 sm:flex-row">
            <Link href="/login" className={cn(buttonVariants({ size: "lg" }), "gap-2")}>
              <HiOutlineChatBubbleLeftRight className="size-5" />
              Start Chatting Free
            </Link>
            <Link
              href="/pricing"
              className={cn(buttonVariants({ variant: "outline", size: "lg" }))}
            >
              View Pricing
            </Link>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-center gap-6 text-sm text-muted-foreground">
            <span className="flex items-center gap-2">
              <HiOutlineShieldCheck className="size-4 text-green-500" />
              No credit card required
            </span>
            <span className="flex items-center gap-2">
              <HiOutlineBolt className="size-4 text-yellow-500" />
              10 free messages/month
            </span>
            <span className="flex items-center gap-2">
              <HiOutlineSparkles className="size-4 text-purple-500" />
              All personalities included
            </span>
          </div>
        </div>
      </section>

      {/* AI Models Section */}
      <section className="border-y bg-muted/30 py-12 md:py-16">
        <div className="container max-w-6xl">
          <div className="text-center">
            <h2 className="text-2xl font-bold md:text-3xl">Choose Your AI Model</h2>
            <p className="mt-2 text-muted-foreground">
              Select the Claude model that best fits your needs
            </p>
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            {aiModels.map((model) => (
              <div
                key={model.name}
                className="relative rounded-lg border bg-background p-6 transition-shadow hover:shadow-md"
              >
                <div className="mb-3 inline-block rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                  {model.badge}
                </div>
                <h3 className="font-semibold">{model.name}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{model.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="container space-y-8 py-12 md:py-16 lg:py-24">
        <div className="mx-auto flex max-w-3xl flex-col items-center space-y-4 text-center">
          <h2 className="font-heading text-3xl font-bold leading-[1.1] md:text-4xl">
            Everything You Need for AI Conversations
          </h2>
          <p className="max-w-2xl text-lg leading-normal text-muted-foreground">
            InfiniStar combines powerful AI capabilities with intuitive design to give you the best
            conversational AI experience.
          </p>
        </div>

        <div className="mx-auto grid max-w-6xl gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="group relative overflow-hidden rounded-lg border bg-background p-6 transition-all hover:border-primary/50 hover:shadow-md"
            >
              <div className="mb-4 inline-flex rounded-lg bg-primary/10 p-3 text-primary">
                <feature.icon className="size-6" />
              </div>
              <h3 className="mb-2 font-semibold">{feature.title}</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">{feature.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Personalities Section */}
      <section className="border-y bg-muted/30 py-12 md:py-16 lg:py-24">
        <div className="container max-w-6xl">
          <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
            <div>
              <h2 className="font-heading text-3xl font-bold md:text-4xl">
                7 Unique AI Personalities
              </h2>
              <p className="mt-4 text-lg text-muted-foreground">
                Every conversation is different. Choose the AI personality that matches your needs,
                or create your own custom persona with specific instructions.
              </p>

              <ul className="mt-8 space-y-4">
                {[
                  { name: "Helpful", desc: "Friendly and balanced assistant" },
                  { name: "Concise", desc: "Brief, to-the-point responses" },
                  { name: "Creative", desc: "Imaginative and original thinking" },
                  { name: "Analytical", desc: "Logical, structured analysis" },
                  { name: "Empathetic", desc: "Understanding and compassionate" },
                  { name: "Professional", desc: "Formal business communication" },
                  { name: "Custom", desc: "Your own system prompts" },
                ].map((personality) => (
                  <li key={personality.name} className="flex items-start gap-3">
                    <HiOutlineSparkles className="mt-0.5 size-5 shrink-0 text-primary" />
                    <div>
                      <span className="font-medium">{personality.name}</span>
                      <span className="text-muted-foreground"> - {personality.desc}</span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            <div className="relative">
              <div className="rounded-lg border bg-background p-6 shadow-xl">
                <div className="mb-4 flex items-center gap-3">
                  <div className="size-10 rounded-full bg-gradient-to-br from-primary to-primary/60" />
                  <div>
                    <div className="font-medium">Creative AI</div>
                    <div className="text-xs text-muted-foreground">Using Claude 3.5 Sonnet</div>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="rounded-lg bg-muted/50 p-3 text-sm">
                    Tell me about quantum computing in a creative way
                  </div>
                  <div className="rounded-lg border bg-primary/5 p-3 text-sm">
                    Imagine quantum bits as tiny dancers on an infinite stage, able to perform
                    multiple moves simultaneously until the moment you observe them...
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Security Section */}
      <section className="container py-12 md:py-16 lg:py-24">
        <div className="mx-auto max-w-3xl text-center">
          <HiOutlineShieldCheck className="mx-auto size-12 text-green-500" />
          <h2 className="font-heading mt-4 text-3xl font-bold md:text-4xl">
            Enterprise-Grade Security
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Your data is protected with industry-leading security measures
          </p>

          <div className="mt-8 grid gap-4 text-left sm:grid-cols-2">
            {[
              "Two-factor authentication (TOTP)",
              "Encrypted TOTP secrets (AES-256-GCM)",
              "CSRF protection on all endpoints",
              "Rate limiting and abuse prevention",
              "Session management with device tracking",
              "Password hashing with bcrypt (12 rounds)",
              "Input sanitization and validation",
              "No-enumeration auth responses",
            ].map((item) => (
              <div key={item} className="flex items-center gap-2 text-sm">
                <HiOutlineShieldCheck className="size-4 shrink-0 text-green-500" />
                {item}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="border-t bg-muted/30 py-12 md:py-16 lg:py-24">
        <div className="container flex max-w-4xl flex-col items-center justify-center gap-6 text-center">
          <h2 className="font-heading text-3xl font-bold md:text-4xl">
            Ready to Experience Intelligent AI Conversations?
          </h2>
          <p className="max-w-2xl text-lg text-muted-foreground">
            Join thousands of users who have transformed their productivity with InfiniStar. Start
            with 10 free messages and upgrade anytime.
          </p>
          <div className="flex flex-col gap-4 sm:flex-row">
            <Link href="/login" className={cn(buttonVariants({ size: "lg" }), "gap-2")}>
              Get Started Free
            </Link>
            <Link
              href={siteConfig.links.github}
              target="_blank"
              rel="noreferrer"
              className={cn(buttonVariants({ variant: "outline", size: "lg" }))}
            >
              View on GitHub
            </Link>
          </div>
        </div>
      </section>
    </>
  )
}
