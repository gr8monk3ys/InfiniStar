import Image from 'next/image'
import { notFound } from 'next/navigation'
import {
  HiCalendar,
  HiChatBubbleLeftRight,
  HiGlobeAlt,
} from 'react-icons/hi2'
import { format } from 'date-fns'

import prisma from '@/app/lib/prismadb'
import { CharacterCard } from '@/app/components/characters/CharacterCard'

export const dynamic = 'force-dynamic'

interface CreatorCharacter {
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
}

interface CreatorProfilePageProps {
  params: Promise<{ userId: string }>
}

export default async function CreatorProfilePage({
  params,
}: CreatorProfilePageProps) {
  const { userId } = await params

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      image: true,
      bio: true,
      website: true,
      createdAt: true,
      characters: {
        where: { isPublic: true },
        orderBy: [
          { usageCount: 'desc' },
          { createdAt: 'desc' },
        ],
        include: {
          createdBy: {
            select: { id: true, name: true, image: true },
          },
        },
      },
    },
  })

  if (!user) notFound()

  const totalChats = user.characters.reduce(
    (sum: number, c: { usageCount: number }) => sum + c.usageCount,
    0
  )

  return (
    <section className="container flex flex-col gap-8 py-10">
      {/* Profile Header */}
      <div className="flex flex-col items-center gap-4 text-center">
        {user.image ? (
          <div className="relative size-24 overflow-hidden rounded-full border-2">
            <Image
              src={user.image}
              alt={user.name || 'Creator'}
              fill
              className="object-cover"
            />
          </div>
        ) : (
          <div className="flex size-24 items-center justify-center rounded-full border-2 bg-primary/10 text-3xl font-bold text-primary">
            {(user.name || '?').slice(0, 1).toUpperCase()}
          </div>
        )}
        <div>
          <h1 className="text-2xl font-bold">
            {user.name || 'Anonymous'}
          </h1>
          {user.bio && (
            <p className="mt-1 max-w-lg text-muted-foreground">
              {user.bio}
            </p>
          )}
        </div>
        <div className="flex items-center gap-6 text-sm text-muted-foreground">
          <span className="flex items-center gap-1">
            <HiCalendar className="size-4" aria-hidden="true" />
            Joined {format(new Date(user.createdAt), 'MMM yyyy')}
          </span>
          <span className="flex items-center gap-1">
            <HiChatBubbleLeftRight
              className="size-4"
              aria-hidden="true"
            />
            {totalChats.toLocaleString()} total chats
          </span>
          {user.website && (
            <a
              href={user.website}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-primary hover:underline"
            >
              <HiGlobeAlt
                className="size-4"
                aria-hidden="true"
              />
              Website
            </a>
          )}
        </div>
      </div>

      {/* Characters Grid */}
      <div>
        <h2 className="mb-4 text-lg font-semibold">
          Characters ({user.characters.length})
        </h2>
        {user.characters.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-12 text-center">
            <p className="text-sm text-muted-foreground">
              No public characters yet.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {user.characters.map((character: CreatorCharacter) => (
              <CharacterCard
                key={character.id}
                character={character}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
