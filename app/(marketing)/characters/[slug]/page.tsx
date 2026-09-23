import { cache } from "react"
import { type Metadata } from "next"
import { notFound } from "next/navigation"

import { matureAccess } from "@/app/lib/nsfw"
import prisma from "@/app/lib/prismadb"

import { CharacterPageBody } from "./CharacterPageBody"
import { MatureCharacterGate } from "./MatureCharacterGate"

interface CharacterPageProps {
  params: Promise<{ slug: string }>
}

/**
 * ISR. The page reads no request state — no `auth()`, no cookies — so the
 * HTML is the same for every visitor and can be cached for an hour. It used
 * to call `getCurrentUser()` for the mature-content gate, which made the
 * `revalidate` below a no-op: every visit was a cold render with a Clerk
 * round trip and three or four database queries.
 *
 * What was per-user moved to the client, resolved from `/api/auth/session`
 * after hydration:
 * - liked state: `CharacterLikeButton` (GET `/api/characters/[id]/like`)
 * - the mature gate: `MatureCharacterGate`, which asks `actions.ts` for the
 *   body once the session confirms the viewer may see it.
 */
export const revalidate = 3600

// No slugs are listed at build (the build has no database), so every page is
// rendered on its first request and cached from then on. `dynamicParams`
// defaults to true.
export function generateStaticParams() {
  return []
}

// `generateMetadata` and the page both need the row; one query per render.
const getCharacterBySlug = cache((slug: string) =>
  prisma.character.findUnique({
    where: { slug },
    include: {
      createdBy: {
        select: { id: true, name: true, image: true },
      },
    },
  })
)

export async function generateMetadata({ params }: CharacterPageProps): Promise<Metadata> {
  const { slug } = await params
  const character = await getCharacterBySlug(slug)
  if (!character) return {}

  // The document for a mature character is the gate; its <head> must not say
  // more than the gate does.
  if (character.isNsfw) {
    return {
      alternates: { canonical: `/characters/${slug}` },
      title: "18+ character | InfiniStar",
      robots: { index: false },
    }
  }

  return {
    alternates: {
      canonical: `/characters/${slug}`,
    },
    title: `${character.name} | InfiniStar`,
    description: character.tagline || character.description || undefined,
    openGraph: {
      title: `${character.name} | InfiniStar`,
      description: character.tagline || character.description || undefined,
      images: character.avatarUrl ? [{ url: character.avatarUrl }] : undefined,
    },
  }
}

export default async function CharacterPage({ params }: CharacterPageProps) {
  const { slug } = await params

  const character = await getCharacterBySlug(slug)

  if (!character || !character.isPublic) {
    notFound()
  }

  if (character.isNsfw) {
    // Nothing about the character reaches the cached document. The body is
    // fetched by the gate, server-rendered per viewer, after the session
    // confirms the preference.
    return <MatureCharacterGate slug={slug} />
  }

  return <CharacterPageBody character={character} access={matureAccess(null)} />
}
