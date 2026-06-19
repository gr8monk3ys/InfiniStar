import { getCategoryName } from "@/app/lib/character-categories"

export interface CharacterJsonLdInput {
  name: string
  slug: string
  tagline: string | null
  description: string | null
  avatarUrl: string | null
  category: string
  usageCount: number
  likeCount: number
  commentCount: number
  createdById: string
  createdByName: string | null
}

export interface CreatorJsonLdInput {
  id: string
  name: string | null
  bio: string | null
  image: string | null
}

interface ListItem {
  "@type": "ListItem"
  position: number
  name: string
  item: string
}

interface AggregateRating {
  "@type": "AggregateRating"
  ratingValue: string
  ratingCount: number
  bestRating: string
  worstRating: string
}

interface InteractionCounter {
  "@type": "InteractionCounter"
  interactionType: string
  userInteractionCount: number
}

export interface PersonNode {
  "@type": "Person"
  name: string
  url: string
  description?: string
  image?: string
}

export interface ProductNode {
  "@type": "Product"
  name: string
  url: string
  description?: string
  image?: string
  category: string
  author: PersonNode
  aggregateRating?: AggregateRating
  interactionStatistic: InteractionCounter
}

export interface BreadcrumbListNode {
  "@type": "BreadcrumbList"
  itemListElement: ListItem[]
}

export interface CharacterJsonLd {
  "@context": "https://schema.org"
  "@graph": Array<ProductNode | BreadcrumbListNode>
}

export interface CreatorJsonLd {
  "@context": "https://schema.org"
  "@type": "ProfilePage"
  mainEntity: PersonNode
}

/**
 * Strips a single trailing slash so we can concatenate path segments safely.
 */
function normalizeBase(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, "")
}

export function buildCharacterJsonLd(
  character: CharacterJsonLdInput,
  baseUrl: string
): CharacterJsonLd {
  const base = normalizeBase(baseUrl)
  const characterUrl = `${base}/characters/${character.slug}`
  const creatorUrl = `${base}/creators/${character.createdById}`
  const categoryName = getCategoryName(character.category)

  const author: PersonNode = {
    "@type": "Person",
    name: character.createdByName || "Anonymous",
    url: creatorUrl,
  }

  const product: ProductNode = {
    "@type": "Product",
    name: character.name,
    url: characterUrl,
    description: character.tagline || character.description || undefined,
    image: character.avatarUrl || undefined,
    category: categoryName,
    author,
    interactionStatistic: {
      "@type": "InteractionCounter",
      interactionType: "https://schema.org/InteractAction",
      userInteractionCount: character.usageCount,
    },
  }

  if (character.likeCount > 0) {
    product.aggregateRating = {
      "@type": "AggregateRating",
      ratingValue: "5",
      ratingCount: character.likeCount,
      bestRating: "5",
      worstRating: "1",
    }
  }

  const breadcrumb: BreadcrumbListNode = {
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: `${base}/` },
      { "@type": "ListItem", position: 2, name: "Explore", item: `${base}/explore` },
      {
        "@type": "ListItem",
        position: 3,
        name: categoryName,
        item: `${base}/explore?category=${encodeURIComponent(character.category)}`,
      },
      { "@type": "ListItem", position: 4, name: character.name, item: characterUrl },
    ],
  }

  return {
    "@context": "https://schema.org",
    "@graph": [product, breadcrumb],
  }
}

export function buildCreatorJsonLd(creator: CreatorJsonLdInput, baseUrl: string): CreatorJsonLd {
  const base = normalizeBase(baseUrl)
  const person: PersonNode = {
    "@type": "Person",
    name: creator.name || "Anonymous",
    url: `${base}/creators/${creator.id}`,
  }
  if (creator.bio) person.description = creator.bio
  if (creator.image) person.image = creator.image

  return {
    "@context": "https://schema.org",
    "@type": "ProfilePage",
    mainEntity: person,
  }
}
