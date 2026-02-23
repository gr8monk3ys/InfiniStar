export interface AffiliatePartner {
  id: string
  name: string
  description: string
  ctaLabel: string
  url: string
}

const AFFILIATE_SOURCE_FALLBACK = "unknown"

export function isEnabled(value: string | undefined): boolean {
  if (!value) {
    return false
  }

  const normalized = value.trim().toLowerCase()
  return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on"
}

// Use getter properties so env vars are re-read on each access (supports test overrides)
export const monetizationConfig = {
  get enableAffiliateLinks() {
    return isEnabled(process.env.NEXT_PUBLIC_ENABLE_AFFILIATE_LINKS)
  },
  get enableAdSense() {
    return isEnabled(process.env.NEXT_PUBLIC_ENABLE_ADSENSE)
  },
  get adSenseClientId() {
    return process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID ?? ""
  },
  get adSenseSlots() {
    return {
      homeInline: process.env.NEXT_PUBLIC_ADSENSE_SLOT_HOME_INLINE ?? "",
      pricingInline: process.env.NEXT_PUBLIC_ADSENSE_SLOT_PRICING_INLINE ?? "",
    }
  },
}

export function buildAffiliatePartnersFromEnv(): AffiliatePartner[] {
  const raw = [
    {
      id: "anthropic",
      name: "Claude Pro",
      description: "Upgrade for higher message limits and faster response tiers.",
      ctaLabel: "View Claude Pro",
      url: process.env.NEXT_PUBLIC_AFFILIATE_ANTHROPIC_URL,
    },
    {
      id: "notion",
      name: "Notion AI",
      description: "Organize AI workflows, docs, and knowledge in one workspace.",
      ctaLabel: "View Notion AI",
      url: process.env.NEXT_PUBLIC_AFFILIATE_NOTION_URL,
    },
    {
      id: "grammarly",
      name: "Grammarly",
      description: "Improve tone and clarity for prompts, drafts, and responses.",
      ctaLabel: "View Grammarly",
      url: process.env.NEXT_PUBLIC_AFFILIATE_GRAMMARLY_URL,
    },
  ]

  return raw
    .filter((partner) => Boolean(partner.url && partner.url.trim().length > 0))
    .map((partner) => ({
      ...partner,
      url: partner.url!.trim(),
    }))
}

// Static array for client components (evaluated once at module load)
export const affiliatePartners: AffiliatePartner[] = buildAffiliatePartnersFromEnv()

export function normalizeAffiliateSource(sourcePage: string | null | undefined): string {
  if (!sourcePage) {
    return AFFILIATE_SOURCE_FALLBACK
  }

  const normalized = sourcePage
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")

  return normalized.length > 0 ? normalized : AFFILIATE_SOURCE_FALLBACK
}

export function getAffiliatePartner(partnerId: string): AffiliatePartner | null {
  // Read from env vars at call time so tests can set env vars without module reload
  const partners = buildAffiliatePartnersFromEnv()
  return partners.find((p) => p.id === partnerId) ?? null
}

export function buildAffiliateRedirectPath(partnerId: string, sourcePage: string): string {
  const normalizedSource = normalizeAffiliateSource(sourcePage)
  const encodedPartnerId = encodeURIComponent(partnerId)
  const encodedSource = encodeURIComponent(normalizedSource)

  return `/api/affiliate/${encodedPartnerId}?source=${encodedSource}`
}

export function buildAffiliateUrl(url: string, sourcePage: string, partnerId: string): string {
  try {
    const parsed = new URL(url)
    const campaign = normalizeAffiliateSource(sourcePage)

    if (!parsed.searchParams.has("utm_source")) {
      parsed.searchParams.set("utm_source", "infinistar")
    }
    if (!parsed.searchParams.has("utm_medium")) {
      parsed.searchParams.set("utm_medium", "affiliate")
    }
    if (!parsed.searchParams.has("utm_campaign")) {
      parsed.searchParams.set("utm_campaign", campaign)
    }
    if (!parsed.searchParams.has("utm_content")) {
      parsed.searchParams.set("utm_content", partnerId)
    }

    return parsed.toString()
  } catch {
    return url
  }
}
