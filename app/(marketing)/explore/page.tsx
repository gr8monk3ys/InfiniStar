import Link from "next/link"
import {
  HiOutlineArchiveBox,
  HiOutlineBriefcase,
  HiOutlineChartBar,
  HiOutlineChatBubbleLeftRight,
  HiOutlineClock,
  HiOutlineDocumentDuplicate,
  HiOutlineDocumentText,
  HiOutlineHeart,
  HiOutlineLightBulb,
  HiOutlineMagnifyingGlass,
  HiOutlineMicrophone,
  HiOutlinePencilSquare,
  HiOutlineShare,
  HiOutlineShieldCheck,
  HiOutlineSparkles,
  HiOutlineTag,
} from "react-icons/hi2"

import prisma from "@/app/lib/prismadb"
import { cn } from "@/app/lib/utils"
import { buttonVariants } from "@/app/components/ui/button"

export const metadata = {
  title: "Explore Features | InfiniStar",
  description: "Discover all the AI personalities and features InfiniStar has to offer",
}

export const dynamic = "force-dynamic"

const personalities = [
  {
    name: "Helpful",
    icon: HiOutlineChatBubbleLeftRight,
    description: "Friendly and balanced assistant for everyday tasks",
    color: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
    examples: ["Explain complex topics simply", "Help with writing tasks", "Answer questions"],
  },
  {
    name: "Concise",
    icon: HiOutlineDocumentText,
    description: "Brief, to-the-point responses that save time",
    color: "bg-green-500/10 text-green-600 dark:text-green-400",
    examples: ["Quick summaries", "TL;DR explanations", "Bullet point answers"],
  },
  {
    name: "Creative",
    icon: HiOutlineLightBulb,
    description: "Imaginative and original thinking for creative projects",
    color: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
    examples: ["Story writing", "Brainstorming ideas", "Creative solutions"],
  },
  {
    name: "Analytical",
    icon: HiOutlineChartBar,
    description: "Logical, structured analysis for complex problems",
    color: "bg-orange-500/10 text-orange-600 dark:text-orange-400",
    examples: ["Data interpretation", "Problem breakdown", "Decision analysis"],
  },
  {
    name: "Empathetic",
    icon: HiOutlineHeart,
    description: "Understanding and compassionate for sensitive topics",
    color: "bg-pink-500/10 text-pink-600 dark:text-pink-400",
    examples: ["Emotional support", "Thoughtful advice", "Active listening"],
  },
  {
    name: "Professional",
    icon: HiOutlineBriefcase,
    description: "Formal business communication for work contexts",
    color: "bg-slate-500/10 text-slate-600 dark:text-slate-400",
    examples: ["Business emails", "Reports", "Meeting summaries"],
  },
  {
    name: "Custom",
    icon: HiOutlinePencilSquare,
    description: "Create your own persona with custom instructions",
    color: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400",
    examples: ["Domain expert", "Specific tone", "Custom rules"],
  },
]

const features = [
  {
    category: "Organization",
    items: [
      {
        icon: HiOutlineArchiveBox,
        name: "Archive",
        description: "Hide conversations without deleting them",
      },
      {
        icon: HiOutlineSparkles,
        name: "Pin",
        description: "Keep important conversations at the top",
      },
      {
        icon: HiOutlineTag,
        name: "Tags",
        description: "Categorize with color-coded tags",
      },
      {
        icon: HiOutlineClock,
        name: "Auto-Delete",
        description: "Automatic cleanup of old conversations",
      },
    ],
  },
  {
    category: "AI Features",
    items: [
      {
        icon: HiOutlineSparkles,
        name: "AI Memory",
        description: "Remember context across conversations",
      },
      {
        icon: HiOutlineLightBulb,
        name: "Suggestions",
        description: "Smart response suggestions",
      },
      {
        icon: HiOutlineDocumentText,
        name: "Summaries",
        description: "AI-generated conversation summaries",
      },
      {
        icon: HiOutlineMicrophone,
        name: "Voice Input",
        description: "Speak instead of typing",
      },
    ],
  },
  {
    category: "Collaboration",
    items: [
      {
        icon: HiOutlineShare,
        name: "Share Links",
        description: "Share conversations with secure links",
      },
      {
        icon: HiOutlineDocumentDuplicate,
        name: "Export",
        description: "Download as Markdown, JSON, or TXT",
      },
      {
        icon: HiOutlineMagnifyingGlass,
        name: "Search",
        description: "Full-text search across all chats",
      },
      {
        icon: HiOutlineShieldCheck,
        name: "Permissions",
        description: "Control who can view or participate",
      },
    ],
  },
]

export default async function ExplorePage() {
  const characters = await prisma.character.findMany({
    where: { isPublic: true },
    orderBy: [{ featured: "desc" }, { usageCount: "desc" }, { createdAt: "desc" }],
    take: 9,
  })

  return (
    <section className="container flex flex-col gap-12 py-8 md:py-12 lg:py-16">
      {/* Header */}
      <div className="mx-auto flex max-w-3xl flex-col items-center gap-4 text-center">
        <h1 className="font-heading text-3xl font-bold leading-tight tracking-tighter md:text-4xl lg:text-5xl">
          Explore InfiniStar Features
        </h1>
        <p className="text-lg text-muted-foreground">
          Discover the AI personalities, smart features, and powerful tools that make InfiniStar
          your ultimate AI companion.
        </p>
      </div>

      {/* Featured Characters */}
      <div>
        <h2 className="mb-6 text-center text-2xl font-bold">Featured Characters</h2>
        <p className="mx-auto mb-8 max-w-2xl text-center text-muted-foreground">
          Browse community-built characters and start a conversation instantly.
        </p>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {characters.length === 0 ? (
            <div className="col-span-full rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
              No public characters yet. Create one to get featured.
            </div>
          ) : (
            characters.map((character) => (
              <div
                key={character.id}
                className="flex flex-col rounded-xl border bg-background p-6 transition-all hover:border-primary/50 hover:shadow-md"
              >
                <h3 className="mb-2 text-lg font-semibold">{character.name}</h3>
                {character.tagline && (
                  <p className="mb-4 text-sm text-muted-foreground">{character.tagline}</p>
                )}
                <div className="mt-auto flex items-center justify-between text-xs text-muted-foreground">
                  <span>{character.usageCount} chats</span>
                  <Link href={`/characters/${character.slug}`} className="text-primary">
                    View
                  </Link>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* AI Personalities */}
      <div>
        <h2 className="mb-6 text-center text-2xl font-bold">AI Personalities</h2>
        <p className="mx-auto mb-8 max-w-2xl text-center text-muted-foreground">
          Choose the personality that fits your needs. Each one is optimized for different types of
          conversations.
        </p>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {personalities.map((personality) => (
            <div
              key={personality.name}
              className="group flex flex-col rounded-xl border bg-background p-6 transition-all hover:border-primary/50 hover:shadow-md"
            >
              <div className={cn("mb-4 inline-flex w-fit rounded-lg p-3", personality.color)}>
                <personality.icon className="size-6" />
              </div>

              <h3 className="mb-2 text-lg font-semibold">{personality.name}</h3>
              <p className="mb-4 text-sm text-muted-foreground">{personality.description}</p>

              <div className="mt-auto">
                <p className="mb-2 text-xs font-medium text-muted-foreground">Best for:</p>
                <ul className="space-y-1">
                  {personality.examples.map((example) => (
                    <li key={example} className="flex items-center gap-2 text-xs">
                      <span className="size-1 rounded-full bg-primary" />
                      {example}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Feature Categories */}
      <div className="space-y-12">
        <h2 className="text-center text-2xl font-bold">Powerful Features</h2>

        {features.map((category) => (
          <div key={category.category}>
            <h3 className="mb-6 text-lg font-semibold text-muted-foreground">
              {category.category}
            </h3>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {category.items.map((feature) => (
                <div
                  key={feature.name}
                  className="flex items-start gap-4 rounded-lg border bg-background p-4 transition-all hover:border-primary/50"
                >
                  <div className="rounded-lg bg-primary/10 p-2 text-primary">
                    <feature.icon className="size-5" />
                  </div>
                  <div>
                    <h4 className="font-medium">{feature.name}</h4>
                    <p className="text-sm text-muted-foreground">{feature.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* AI Models */}
      <div className="rounded-xl border bg-muted/30 p-8">
        <h2 className="mb-6 text-center text-2xl font-bold">Powered by Claude AI</h2>
        <div className="mx-auto grid max-w-4xl gap-6 md:grid-cols-3">
          <div className="rounded-lg border bg-background p-6 text-center">
            <div className="mb-2 inline-block rounded-full bg-blue-500/10 px-3 py-1 text-xs font-medium text-blue-600 dark:text-blue-400">
              Recommended
            </div>
            <h3 className="text-lg font-semibold">Claude 3.5 Sonnet</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Balanced performance with excellent reasoning and fast responses
            </p>
          </div>

          <div className="rounded-lg border bg-background p-6 text-center">
            <div className="mb-2 inline-block rounded-full bg-green-500/10 px-3 py-1 text-xs font-medium text-green-600 dark:text-green-400">
              Fastest
            </div>
            <h3 className="text-lg font-semibold">Claude 3.5 Haiku</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Lightning-fast responses perfect for quick tasks and high volume
            </p>
          </div>

          <div className="rounded-lg border bg-background p-6 text-center">
            <div className="mb-2 inline-block rounded-full bg-purple-500/10 px-3 py-1 text-xs font-medium text-purple-600 dark:text-purple-400">
              Most Powerful
            </div>
            <h3 className="text-lg font-semibold">Claude 3 Opus</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Maximum capability for complex reasoning and nuanced tasks
            </p>
          </div>
        </div>
      </div>

      {/* CTA */}
      <div className="flex flex-col items-center gap-4 text-center">
        <h2 className="text-2xl font-bold">Ready to Get Started?</h2>
        <p className="max-w-lg text-muted-foreground">
          Try InfiniStar free with 10 messages per month. No credit card required.
        </p>
        <div className="flex gap-4">
          <Link href="/login" className={cn(buttonVariants({ size: "lg" }))}>
            Start Free
          </Link>
          <Link href="/pricing" className={cn(buttonVariants({ variant: "outline", size: "lg" }))}>
            View Pricing
          </Link>
        </div>
      </div>
    </section>
  )
}
