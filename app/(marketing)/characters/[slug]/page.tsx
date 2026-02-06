import Image from "next/image"
import { notFound } from "next/navigation"

import prisma from "@/app/lib/prismadb"
import { CharacterStartChatButton } from "@/app/components/characters/CharacterStartChatButton"

interface CharacterPageProps {
  params: Promise<{ slug: string }>
}

export const dynamic = "force-dynamic"

export default async function CharacterPage({ params }: CharacterPageProps) {
  const { slug } = await params

  const character = await prisma.character.findUnique({
    where: { slug },
    include: {
      createdBy: { select: { name: true, image: true } },
    },
  })

  if (!character || !character.isPublic) {
    notFound()
  }

  await prisma.character.update({
    where: { id: character.id },
    data: { viewCount: { increment: 1 } },
  })

  return (
    <section className="container flex flex-col gap-8 py-10">
      <div className="flex flex-col gap-6 md:flex-row md:items-center">
        {character.avatarUrl ? (
          <div className="relative size-24 overflow-hidden rounded-2xl border">
            <Image src={character.avatarUrl} alt={character.name} fill className="object-cover" />
          </div>
        ) : (
          <div className="flex size-24 items-center justify-center rounded-2xl border text-2xl font-semibold">
            {character.name.slice(0, 1)}
          </div>
        )}
        <div className="flex-1 space-y-2">
          <h1 className="text-3xl font-bold">{character.name}</h1>
          {character.tagline && <p className="text-muted-foreground">{character.tagline}</p>}
          <div className="text-xs text-muted-foreground">
            Created by {character.createdBy?.name || "Unknown"} • {character.usageCount} chats
          </div>
        </div>
        <CharacterStartChatButton characterId={character.id} />
      </div>

      {character.description && (
        <div className="rounded-xl border bg-background p-6">
          <h2 className="mb-2 text-lg font-semibold">About</h2>
          <p className="text-muted-foreground">{character.description}</p>
        </div>
      )}

      {character.greeting && (
        <div className="rounded-xl border bg-background p-6">
          <h2 className="mb-2 text-lg font-semibold">Greeting</h2>
          <p className="text-muted-foreground">{character.greeting}</p>
        </div>
      )}

      {character.tags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {character.tags.map((tag) => (
            <span
              key={tag}
              className="rounded-full border bg-muted px-3 py-1 text-xs text-muted-foreground"
            >
              {tag}
            </span>
          ))}
        </div>
      )}
    </section>
  )
}
