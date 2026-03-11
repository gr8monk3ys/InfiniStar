import Link from "next/link"

import { siteConfig } from "@/config/site"
import { Icons } from "@/app/components/icons"

const productLinks = [
  { href: "/explore", label: "Explore" },
  { href: "/feed", label: "Creator Feed" },
  { href: "/pricing", label: "Pricing" },
]

const companyLinks = [
  { href: "/privacy", label: "Privacy" },
  { href: "/terms", label: "Terms" },
  { href: siteConfig.links.docs, label: "Docs", external: true },
  { href: siteConfig.links.github, label: "GitHub", external: true },
  { href: siteConfig.links.support, label: "Support", external: true },
]

export function SiteFooter() {
  return (
    <footer className="relative overflow-hidden border-t border-border/60 bg-background/95">
      <div className="from-primary/8 pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b to-transparent" />

      <div className="container relative grid gap-8 py-10 md:grid-cols-[1.4fr_1fr_1fr] md:py-12">
        <div className="max-w-md">
          <Link href="/" className="inline-flex items-center gap-2">
            <Icons.logo className="size-6" />
            <span className="font-heading gradient-text text-lg font-bold">{siteConfig.name}</span>
          </Link>
          <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
            Character-first AI chat for creators, roleplayers, and people who want more memorable
            conversations than a blank assistant box.
          </p>
        </div>

        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Product
          </p>
          <div className="mt-4 flex flex-col gap-3 text-sm">
            {productLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-muted-foreground transition-colors hover:text-foreground"
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>

        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Company
          </p>
          <div className="mt-4 flex flex-col gap-3 text-sm">
            {companyLinks.map((link) =>
              link.external ? (
                <a
                  key={link.href}
                  href={link.href}
                  target={link.href.startsWith("mailto:") ? undefined : "_blank"}
                  rel={link.href.startsWith("mailto:") ? undefined : "noreferrer"}
                  className="text-muted-foreground transition-colors hover:text-foreground"
                >
                  {link.label}
                </a>
              ) : (
                <Link
                  key={link.href}
                  href={link.href}
                  className="text-muted-foreground transition-colors hover:text-foreground"
                >
                  {link.label}
                </Link>
              )
            )}
          </div>
        </div>
      </div>

      <div className="border-t border-border/60">
        <div className="container flex flex-col gap-2 py-4 text-sm text-muted-foreground md:flex-row md:items-center md:justify-between">
          <p>&copy; {new Date().getFullYear()} {siteConfig.name}. All rights reserved.</p>
          <p>Built for creator-led worlds, fandom roleplay, and late-night curiosity.</p>
        </div>
      </div>
    </footer>
  )
}
