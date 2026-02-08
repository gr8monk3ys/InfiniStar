"use client"

import { memo } from "react"
import Image from "next/image"
import Link from "next/link"
import { HiChatBubbleLeftRight, HiHeart, HiOutlineHeart } from "react-icons/hi2"

import { getCategoryById } from "@/app/lib/character-categories"
import { cn } from "@/app/lib/utils"

interface CharacterCardProps {
  character: {
    id: string
    slug: string
    name: string
    tagline?: string | null
    avatarUrl?: string | null
    category: string
    usageCount: number
    likeCount: number
    createdBy?: {
      id: string
      name: string | null
      image: string | null
    } | null
  }
  isLiked?: boolean
  onLike?: (characterId: string) => void
  onUnlike?: (characterId: string) => void
}

const CharacterCard = memo(function CharacterCard({
  character,
  isLiked = false,
  onLike,
  onUnlike,
}: CharacterCardProps) {
  const category = getCategoryById(character.category)

  const handleLikeClick = (e: React.MouseEvent): void => {
    e.preventDefault()
    e.stopPropagation()
    if (isLiked && onUnlike) {
      onUnlike(character.id)
    } else if (!isLiked && onLike) {
      onLike(character.id)
    }
  }

  return (
    <Link
      href={`/characters/${character.slug}`}
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-xl border border-border/50",
        "bg-card transition-all duration-300",
        "hover:-translate-y-1 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/10"
      )}
    >
      {/* Image Section - 3:4 aspect ratio */}
      <div className="relative aspect-[3/4] w-full overflow-hidden bg-muted">
        {character.avatarUrl ? (
          <Image
            src={character.avatarUrl}
            alt={character.name}
            fill
            className="object-cover transition-transform duration-300 group-hover:scale-105"
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-violet-600 to-blue-500">
            <span className="text-5xl font-bold text-white/90">
              {character.name.slice(0, 1).toUpperCase()}
            </span>
          </div>
        )}

        {/* Bottom gradient overlay */}
        <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/60 to-transparent" />

        {/* Stats overlay on image */}
        <div className="absolute bottom-2 left-2 flex items-center gap-2">
          <span className="flex items-center gap-1 rounded-full bg-black/50 px-2 py-0.5 text-xs text-white/90 backdrop-blur-sm">
            <HiChatBubbleLeftRight className="size-3" />
            {character.usageCount}
          </span>
          <span className="flex items-center gap-1 rounded-full bg-black/50 px-2 py-0.5 text-xs text-white/90 backdrop-blur-sm">
            <HiHeart className="size-3" />
            {character.likeCount}
          </span>
        </div>

        {/* Like button overlay */}
        {(onLike || onUnlike) && (
          <button
            onClick={handleLikeClick}
            className={cn(
              "absolute right-2 top-2 rounded-full p-1.5 backdrop-blur-sm transition-all",
              isLiked
                ? "bg-red-500/20 text-red-500"
                : "bg-black/30 text-white/70 hover:bg-black/50 hover:text-white"
            )}
            aria-label={isLiked ? "Unlike character" : "Like character"}
          >
            {isLiked ? <HiHeart className="size-5" /> : <HiOutlineHeart className="size-5" />}
          </button>
        )}
      </div>

      {/* Text Section */}
      <div className="flex flex-1 flex-col gap-1.5 p-3">
        <h3 className="truncate text-sm font-semibold transition-colors group-hover:text-primary">
          {character.name}
        </h3>
        {character.createdBy?.name && (
          <p className="truncate text-xs text-muted-foreground">by {character.createdBy.name}</p>
        )}
        {character.tagline && (
          <p className="line-clamp-2 text-xs text-muted-foreground">{character.tagline}</p>
        )}

        {/* Category pill */}
        {category && (
          <div className="mt-auto pt-2">
            <span
              className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium", category.color)}
            >
              {category.emoji} {category.name}
            </span>
          </div>
        )}
      </div>
    </Link>
  )
})

export { CharacterCard }
