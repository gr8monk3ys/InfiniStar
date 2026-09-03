import Link from "next/link"
import {
  HiArrowRight,
  HiOutlineBolt,
  HiOutlineChatBubbleLeftRight,
  HiOutlineShieldCheck,
} from "react-icons/hi2"

import { cn } from "@/app/lib/utils"
import { buttonVariants } from "@/app/components/ui/button"

interface AuthShellProps {
  title: string
  description: string
  /** Short label above the form, e.g. "Sign in to talk to Nyra". Omit for the generic case. */
  cardEyebrow?: string
  children: React.ReactNode
}

const authHighlights = [
  {
    icon: HiOutlineChatBubbleLeftRight,
    title: "Find characters with a real point of view",
    description: "Explore creator-built personalities instead of another generic chatbot shell.",
  },
  {
    icon: HiOutlineBolt,
    title: "Keep the thread going",
    description: "Come back to favorites, saved context, and longer-running conversations.",
  },
  {
    icon: HiOutlineShieldCheck,
    title: "Start with a safer account setup",
    description: "Use one place for sign-in, billing, creator tools, and privacy controls.",
  },
]

export const authAppearance = {
  elements: {
    rootBox: "w-full",
    card: "w-full border-0 bg-transparent p-0 shadow-none",
    headerTitle: "hidden",
    headerSubtitle: "hidden",
    socialButtonsBlockButton:
      "h-11 rounded-xl border border-border/60 bg-background text-foreground shadow-none transition-colors hover:bg-accent",
    socialButtonsBlockButtonText: "text-sm font-medium text-foreground",
    dividerLine: "bg-border",
    dividerText: "text-xs uppercase tracking-[0.2em] text-muted-foreground",
    formFieldLabel: "text-sm font-medium text-foreground",
    formFieldInput:
      "h-11 rounded-xl border border-input bg-background text-foreground shadow-none focus:border-primary focus:ring-2 focus:ring-primary/20",
    formButtonPrimary:
      "h-11 rounded-xl gradient-bg-cta text-sm font-semibold text-white shadow-lg shadow-primary/25 hover:opacity-90",
    footerActionLink: "font-medium text-primary hover:text-primary/80",
    formFieldAction: "font-medium text-primary hover:text-primary/80",
    identityPreviewEditButton: "font-medium text-primary hover:text-primary/80",
    alert: "rounded-xl border border-amber-500/30 bg-amber-500/10 text-foreground",
    alertText: "text-sm",
    otpCodeFieldInput:
      "h-11 rounded-xl border border-input bg-background text-foreground shadow-none focus:border-primary focus:ring-2 focus:ring-primary/20",
  },
} as const

export function AuthShell({ title, description, cardEyebrow, children }: AuthShellProps) {
  return (
    <section className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-1/2 top-0 h-[32rem] w-[32rem] -translate-x-1/2 rounded-full bg-gradient-to-br from-[hsl(var(--aurora-violet)/0.15)] via-[hsl(var(--aurora-fuchsia)/0.10)] to-[hsl(var(--aurora-amber)/0.10)] blur-[96px]" />
        <div className="absolute bottom-0 left-0 h-72 w-72 rounded-full bg-primary/10 blur-[80px]" />
      </div>

      <div className="container relative grid min-h-[calc(100vh-4rem)] max-w-6xl gap-10 py-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:py-16">
        <div className="max-w-2xl space-y-8">
          <div className="space-y-4">
            <h1 className="max-w-xl font-heading text-4xl font-bold tracking-tight [text-wrap:balance] sm:text-5xl">
              {title}
            </h1>
            <p className="max-w-xl text-base leading-relaxed text-foreground/75 [text-wrap:pretty] sm:text-lg">
              {description}
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {authHighlights.map((item) => (
              <div
                key={item.title}
                className="rounded-2xl border border-border/60 bg-background/80 p-4 shadow-sm backdrop-blur"
              >
                <item.icon className="size-5 text-primary" aria-hidden="true" />
                <h2 className="mt-4 text-sm font-semibold text-foreground">{item.title}</h2>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {item.description}
                </p>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap gap-3">
            <Link href="/explore" className={cn(buttonVariants({ variant: "outline" }), "gap-2")}>
              Browse characters
              <HiArrowRight className="size-4" aria-hidden="true" />
            </Link>
            <Link href="/pricing" className={cn(buttonVariants({ variant: "ghost" }), "gap-2")}>
              See plans
            </Link>
          </div>
        </div>

        <div className="relative">
          <div className="absolute inset-0 rounded-[2rem] bg-gradient-to-br from-primary/10 via-transparent to-primary/10 blur-2xl" />
          <div className="relative rounded-[2rem] border border-border/60 bg-background/90 p-5 shadow-2xl shadow-primary/5 backdrop-blur md:p-8">
            {cardEyebrow ? (
              <p className="mb-6 text-sm font-medium text-primary-accent">{cardEyebrow}</p>
            ) : null}

            {children}

            <div className="mt-6 space-y-4 border-t border-border/60 pt-5 text-sm text-muted-foreground">
              <p className="leading-relaxed">
                Free accounts include 50 AI messages a month. By continuing you agree to our{" "}
                <Link
                  href="/terms"
                  className="font-medium text-primary-accent underline underline-offset-4 hover:text-primary-accent/80"
                >
                  Terms
                </Link>{" "}
                and{" "}
                <Link
                  href="/privacy"
                  className="font-medium text-primary-accent underline underline-offset-4 hover:text-primary-accent/80"
                >
                  Privacy Policy
                </Link>
                .
              </p>

              <div>
                <p className="font-medium text-foreground">Need help signing in?</p>
                <p className="mt-1 leading-relaxed">
                  If the secure form does not load, refresh once or email{" "}
                  <a
                    href="mailto:support@infinistar.app"
                    className="font-medium text-primary-accent underline underline-offset-4 hover:text-primary-accent/80"
                  >
                    support@infinistar.app
                  </a>
                  .
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
