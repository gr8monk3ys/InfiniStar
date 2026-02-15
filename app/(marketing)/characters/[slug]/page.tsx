import Image from "next/image"
import Link from "next/link"
import { notFound } from "next/navigation"
import { auth } from "@clerk/nextjs/server"
import { HiChatBubbleLeftRight, HiEye, HiHeart, HiUser } from "react-icons/hi2"

import { getCategoryById } from "@/app/lib/character-categories"
import prisma from "@/app/lib/prismadb"
import { cn } from "@/app/lib/utils"
import { CharacterCard } from "@/app/components/characters/CharacterCard"
import { CharacterLikeButton } from "@/app/components/characters/CharacterLikeButton"
import { CharacterRemixButton } from "@/app/components/characters/CharacterRemixButton"
import { CharacterStartChatButton } from "@/app/components/characters/CharacterStartChatButton"

interface SimilarCharacter {
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

interface CharacterPageProps {
  params: Promise<{ slug: string }>
}

export const dynamic = "force-dynamic"

export default async function CharacterPage({ params }: CharacterPageProps) {
  const { slug } = await params

  const character = await prisma.character.findUnique({
    where: { slug },
    include: {
      createdBy: {
        select: { id: true, name: true, image: true },
      },
    },
  })

  if (!character || !character.isPublic) {
    notFound()
  }

  // Increment view count
  await prisma.character.update({
    where: { id: character.id },
    data: { viewCount: { increment: 1 } },
  })

  // Check if current user has liked this character
  const { userId } = await auth()
  let hasLiked = false

  if (userId) {
    const currentUser = await prisma.user.findUnique({
      where: { clerkId: userId },
      select: { id: true },
    })

    if (currentUser) {
      const like = await prisma.characterLike.findUnique({
        where: {
          userId_characterId: {
            userId: currentUser.id,
            characterId: character.id,
          },
        },
      })
      hasLiked = !!like
    }
  }

  // Get category info
  const category = getCategoryById(character.category)

  // Fetch similar characters (same category, exclude current)
  const similarCharacters = await prisma.character.findMany({
    where: {
      isPublic: true,
      category: character.category,
      id: { not: character.id },
    },
    orderBy: [{ usageCount: "desc" }, { createdAt: "desc" }],
    take: 4,
    include: {
      createdBy: {
        select: { id: true, name: true, image: true },
      },
    },
  })

  // Determine gradient colors based on category
  const gradientMap: Record<string, string> = {
    general: "from-gray-600 to-gray-800",
    anime: "from-pink-500 to-purple-600",
    fantasy: "from-purple-500 to-indigo-700",
    romance: "from-rose-400 to-pink-600",
    helper: "from-blue-500 to-cyan-600",
    roleplay: "from-amber-500 to-orange-600",
    education: "from-green-500 to-emerald-700",
    comedy: "from-yellow-400 to-amber-600",
    adventure: "from-orange-500 to-red-600",
    scifi: "from-cyan-400 to-blue-700",
  }

  const gradient = gradientMap[character.category] || gradientMap.general

  return (
    <section className="pb-16">
      {/* Hero / Cover Section */}
      <div className="relative">
        {/* Cover Image or Gradient Fallback */}
        <div
          className={cn(
            "relative h-48 w-full sm:h-56 md:h-64",
            !character.coverImageUrl && `bg-gradient-to-br ${gradient}`
          )}
          role="img"
          aria-label={`${character.name} cover image`}
        >
          {character.coverImageUrl && (
            <Image
              src={character.coverImageUrl}
              alt={`${character.name} cover`}
              fill
              className="object-cover"
              priority
            />
          )}
          {/* Overlay gradient for text readability */}
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
        </div>

        {/* Avatar overlapping the cover */}
        <div className="container relative">
          <div className="absolute -top-16 left-6 sm:-top-20 sm:left-8">
            {character.avatarUrl ? (
              <div className="relative size-28 overflow-hidden rounded-2xl border-4 border-background shadow-xl sm:size-32">
                <Image
                  src={character.avatarUrl}
                  alt={character.name}
                  fill
                  className="object-cover"
                  priority
                />
              </div>
            ) : (
              <div
                className={cn(
                  "flex size-28 items-center justify-center",
                  "rounded-2xl border-4 border-background shadow-xl sm:size-32",
                  "bg-gradient-to-br text-4xl font-bold text-white",
                  gradient
                )}
              >
                {character.name.slice(0, 1).toUpperCase()}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mt-20 flex flex-col gap-8 sm:mt-16">
        {/* Header: Name, Tagline, Category */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex-1 space-y-2">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold sm:text-3xl">{character.name}</h1>
              {category && (
                <span className={cn("rounded-full px-3 py-1 text-xs font-medium", category.color)}>
                  {category.emoji} {category.name}
                </span>
              )}
            </div>
            {character.tagline && (
              <p className="max-w-2xl text-lg text-muted-foreground">{character.tagline}</p>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-3">
            <CharacterStartChatButton characterId={character.id} />
            <CharacterLikeButton
              characterId={character.id}
              initialLiked={hasLiked}
              initialCount={character.likeCount}
            />
            <CharacterRemixButton characterId={character.id} />
          </div>
        </div>

        {/* Stats Row */}
        <div className="flex items-center gap-6 border-y py-4" aria-label="Character statistics">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <HiChatBubbleLeftRight className="size-5" aria-hidden="true" />
            <span>
              <span className="font-semibold text-foreground">
                {character.usageCount.toLocaleString()}
              </span>{" "}
              chats
            </span>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <HiHeart className="size-5" aria-hidden="true" />
            <span>
              <span className="font-semibold text-foreground">
                {character.likeCount.toLocaleString()}
              </span>{" "}
              likes
            </span>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <HiEye className="size-5" aria-hidden="true" />
            <span>
              <span className="font-semibold text-foreground">
                {(character.viewCount + 1).toLocaleString()}
              </span>{" "}
              views
            </span>
          </div>
        </div>

        {/* Two-column layout on larger screens */}
        <div className="grid gap-8 lg:grid-cols-3">
          {/* Left column: About, Greeting */}
          <div className="flex flex-col gap-6 lg:col-span-2">
            {/* About Section */}
            {character.description && (
              <div className="rounded-xl border bg-card p-6 shadow-sm">
                <h2 className="mb-3 text-lg font-semibold">About</h2>
                <p className="whitespace-pre-wrap leading-relaxed text-muted-foreground">
                  {character.description}
                </p>
              </div>
            )}

            {/* Greeting Preview */}
            {character.greeting && (
              <div className="rounded-xl border bg-card p-6 shadow-sm">
                <h2 className="mb-3 text-lg font-semibold">Greeting Preview</h2>
                <div className="flex gap-3">
                  {/* Mini avatar */}
                  {character.avatarUrl ? (
                    <div className="relative size-8 shrink-0 overflow-hidden rounded-full border">
                      <Image
                        src={character.avatarUrl}
                        alt=""
                        fill
                        className="object-cover"
                        aria-hidden="true"
                      />
                    </div>
                  ) : (
                    <div
                      className={cn(
                        "flex size-8 shrink-0 items-center justify-center",
                        "rounded-full text-xs font-bold text-white",
                        "bg-gradient-to-br",
                        gradient
                      )}
                      aria-hidden="true"
                    >
                      {character.name.slice(0, 1).toUpperCase()}
                    </div>
                  )}
                  <div className="rounded-2xl rounded-tl-none border bg-muted/50 px-4 py-3">
                    <p className="text-sm leading-relaxed text-muted-foreground">
                      {character.greeting}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Right column: Tags, Creator */}
          <div className="flex flex-col gap-6">
            {/* Tags */}
            {character.tags.length > 0 && (
              <div className="rounded-xl border bg-card p-6 shadow-sm">
                <h2 className="mb-3 text-lg font-semibold">Tags</h2>
                <div className="flex flex-wrap gap-2">
                  {character.tags.map((tag: string) => (
                    <span
                      key={tag}
                      className="rounded-full border bg-muted px-3 py-1 text-xs font-medium text-muted-foreground"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Creator Info */}
            <div className="rounded-xl border bg-card p-6 shadow-sm">
              <h2 className="mb-3 text-lg font-semibold">Creator</h2>
              <Link
                href={`/creators/${character.createdById}`}
                className="flex items-center gap-3 rounded-lg p-2 transition-colors hover:bg-accent"
              >
                {character.createdBy?.image ? (
                  <div className="relative size-10 overflow-hidden rounded-full border">
                    <Image
                      src={character.createdBy.image}
                      alt={character.createdBy.name || "Creator"}
                      fill
                      className="object-cover"
                    />
                  </div>
                ) : (
                  <div className="flex size-10 items-center justify-center rounded-full border bg-primary/10 text-sm font-bold text-primary">
                    <HiUser className="size-5" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {character.createdBy?.name || "Anonymous"}
                  </p>
                  <p className="text-xs text-muted-foreground">View profile</p>
                </div>
              </Link>
            </div>
          </div>
        </div>

        {/* Similar Characters */}
        {similarCharacters.length > 0 && (
          <div className="mt-4">
            <h2 className="mb-4 text-lg font-semibold">Similar Characters</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {similarCharacters.map((similar: SimilarCharacter) => (
                <CharacterCard key={similar.id} character={similar} />
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
