import { HiOutlineSparkles } from "react-icons/hi2"

import {
  affiliatePartners,
  buildAffiliateRedirectPath,
  monetizationConfig,
} from "@/app/lib/monetization"
import { cn } from "@/app/lib/utils"
import { buttonVariants } from "@/app/components/ui/button"

interface AffiliatePartnersSectionProps {
  sourcePage: string
  className?: string
}

export function AffiliatePartnersSection({ sourcePage, className }: AffiliatePartnersSectionProps) {
  if (!monetizationConfig.enableAffiliateLinks || affiliatePartners.length === 0) {
    return null
  }

  return (
    <section className={cn("border-y border-border/50 py-16 md:py-24", className)}>
      <div className="container max-w-6xl">
        <div className="mx-auto mb-10 max-w-2xl text-center">
          <h2 className="font-heading text-3xl font-bold md:text-4xl">
            Partner Tools We Recommend
          </h2>
          <p className="mt-3 text-muted-foreground">
            Helpful products for better prompts, writing, and AI workflows.
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            Disclosure: Some links are affiliate links and may earn us a commission.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {affiliatePartners.map((partner) => (
            <article
              key={partner.id}
              className="group rounded-2xl border border-border/50 bg-card p-6 transition-all duration-300 hover:border-primary/30 hover:shadow-lg"
            >
              <div className="mb-4 inline-flex rounded-lg border border-primary/20 bg-primary/5 p-2">
                <HiOutlineSparkles className="size-4 text-primary" />
              </div>
              <h3 className="mb-2 text-lg font-semibold">{partner.name}</h3>
              <p className="mb-5 text-sm text-muted-foreground">{partner.description}</p>
              <a
                href={buildAffiliateRedirectPath(partner.id, sourcePage)}
                target="_blank"
                rel="sponsored noopener noreferrer"
                className={cn(buttonVariants({ variant: "outline" }), "w-full")}
                data-testid={`affiliate-link-${partner.id}`}
              >
                {partner.ctaLabel}
              </a>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}
