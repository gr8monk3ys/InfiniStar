import type { Metadata } from 'next'
import Link from 'next/link'
import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { HiOutlineHeart } from 'react-icons/hi2'

import { authOptions } from '@/app/lib/auth'
import prisma from '@/app/lib/prismadb'
import { cn } from '@/app/lib/utils'
import { buttonVariants } from '@/app/components/ui/button'

import FavoritesGrid from './FavoritesGrid'

interface CharacterLikeWithCharacter {
  createdAt: Date
  character: {
    id: string
    slug: string
    name: string
    tagline: string | null
    avatarUrl: string | null
    category: string
    usageCount: number
    likeCount: number
    createdBy: {
      id: string
      name: string | null
      image: string | null
    } | null
    [key: string]: unknown
  }
}

export const metadata: Metadata = {
  title: 'Favorites | InfiniStar',
  description: 'Your favorite AI characters',
}

export default async function FavoritesPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) redirect('/login')

  const likes = await prisma.characterLike.findMany({
    where: { userId: session.user.id },
    include: {
      character: {
        include: {
          createdBy: {
            select: { id: true, name: true, image: true },
          },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  })

  const characters = likes.map((like: CharacterLikeWithCharacter) => ({
    ...like.character,
    likedAt: like.createdAt,
  }))

  return (
    <div className="h-full lg:pl-80">
      <div className="flex h-full flex-col p-6">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Favorites</h1>
            <p className="text-sm text-muted-foreground">
              {characters.length} character
              {characters.length !== 1 ? 's' : ''}
            </p>
          </div>
          <Link
            href="/explore"
            className={cn(buttonVariants({ variant: 'outline' }))}
          >
            Discover More
          </Link>
        </div>

        {characters.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
            <div className="rounded-full bg-muted p-6">
              <HiOutlineHeart className="size-12 text-muted-foreground" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">
                No favorites yet
              </h2>
              <p className="text-sm text-muted-foreground">
                Like characters to save them here for quick access.
              </p>
            </div>
            <Link
              href="/explore"
              className={cn(buttonVariants())}
            >
              Explore Characters
            </Link>
          </div>
        ) : (
          <FavoritesGrid characters={characters} />
        )}
      </div>
    </div>
  )
}
