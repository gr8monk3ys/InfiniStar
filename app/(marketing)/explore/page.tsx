import { getServerSession } from 'next-auth'

import prisma from '@/app/lib/prismadb'
import { authOptions } from '@/app/lib/auth'
import ExploreClient from './ExploreClient'

export const metadata = {
  title: 'Explore Characters | InfiniStar',
  description:
    'Discover community-created AI characters. Chat with anime heroes, fantasy companions, helpful assistants, and more.',
}

export const dynamic = 'force-dynamic'

const CHARACTER_SELECT = {
  id: true,
  slug: true,
  name: true,
  tagline: true,
  avatarUrl: true,
  category: true,
  usageCount: true,
  likeCount: true,
  createdBy: {
    select: {
      id: true,
      name: true,
      image: true,
    },
  },
} as const

export default async function ExplorePage() {
  const session = await getServerSession(authOptions)

  const [featured, trending, all, likedRecords] =
    await Promise.all([
      // Featured characters
      prisma.character.findMany({
        where: { isPublic: true, featured: true },
        orderBy: { usageCount: 'desc' },
        take: 6,
        select: CHARACTER_SELECT,
      }),

      // Trending characters
      prisma.character.findMany({
        where: { isPublic: true },
        orderBy: { usageCount: 'desc' },
        take: 12,
        select: CHARACTER_SELECT,
      }),

      // All public characters (newest first)
      prisma.character.findMany({
        where: { isPublic: true },
        orderBy: { createdAt: 'desc' },
        take: 24,
        select: CHARACTER_SELECT,
      }),

      // User's liked character IDs
      session?.user?.id
        ? prisma.characterLike.findMany({
            where: { userId: session.user.id },
            select: { characterId: true },
          })
        : Promise.resolve([]),
    ])

  const likedIds = likedRecords.map(
    (r: { characterId: string }) => r.characterId
  )

  return (
    <section className="container py-8 md:py-12 lg:py-16">
      <ExploreClient
        featured={featured}
        trending={trending}
        all={all}
        likedIds={likedIds}
      />
    </section>
  )
}
