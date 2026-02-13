export interface AffiliatePartner {
  id: string
  name: string
  description: string
  ctaLabel: string
  url: string
}

const AFFILIATE_SOURCE_FALLBACK = "unknown"

function isEnabled(value: string | undefined): boolean {
  if (!value) {
    return false
  }

  const normalized = value.trim().toLowerCase()
  return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on"
}

export const monetizationConfig = {
  enableAffiliateLinks: isEnabled(process.env.NEXT_PUBLIC_ENABLE_AFFILIATE_LINKS),
  enableAdSense: isEnabled(process.env.NEXT_PUBLIC_ENABLE_ADSENSE),
  adSenseClientId: process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID ?? "",
  adSenseSlots: {
    homeInline: process.env.NEXT_PUBLIC_ADSENSE_SLOT_HOME_INLINE ?? "",
    pricingInline: process.env.NEXT_PUBLIC_ADSENSE_SLOT_PRICING_INLINE ?? "",
  },
}

const rawAffiliatePartners = [
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

export const affiliatePartners: AffiliatePartner[] = rawAffiliatePartners
  .filter((partner) => Boolean(partner.url && partner.url.trim().length > 0))
  .map((partner) => ({
    ...partner,
    url: partner.url!.trim(),
  }))

const affiliatePartnersById = new Map(affiliatePartners.map((partner) => [partner.id, partner]))

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
  return affiliatePartnersById.get(partnerId) ?? null
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
