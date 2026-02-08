'use client'

import { memo } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import {
  HiHeart,
  HiOutlineHeart,
  HiChatBubbleLeftRight,
} from 'react-icons/hi2'

import { cn } from '@/app/lib/utils'
import { getCategoryById } from '@/app/lib/character-categories'

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
        'group flex flex-col overflow-hidden rounded-xl border',
        'bg-background transition-all',
        'hover:border-primary/50 hover:shadow-lg'
      )}
    >
      {/* Avatar Section */}
      <div className="relative flex items-center gap-3 p-4 pb-2">
        {character.avatarUrl ? (
          <div className="relative size-12 shrink-0 overflow-hidden rounded-full border">
            <Image
              src={character.avatarUrl}
              alt={character.name}
              fill
              className="object-cover"
            />
          </div>
        ) : (
          <div
            className={cn(
              'flex size-12 shrink-0 items-center justify-center',
              'rounded-full border bg-primary/10',
              'text-lg font-bold text-primary'
            )}
          >
            {character.name.slice(0, 1).toUpperCase()}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-semibold group-hover:text-primary">
            {character.name}
          </h3>
          {character.createdBy?.name && (
            <p className="truncate text-xs text-muted-foreground">
              by {character.createdBy.name}
            </p>
          )}
        </div>
        {/* Like Button */}
        {(onLike || onUnlike) && (
          <button
            onClick={handleLikeClick}
            className={cn(
              'shrink-0 rounded-full p-1.5 transition-colors',
              'hover:bg-accent'
            )}
            aria-label={
              isLiked ? 'Unlike character' : 'Like character'
            }
          >
            {isLiked ? (
              <HiHeart className="size-5 text-red-500" />
            ) : (
              <HiOutlineHeart className="size-5 text-muted-foreground" />
            )}
          </button>
        )}
      </div>

      {/* Tagline */}
      {character.tagline && (
        <p className="line-clamp-2 px-4 text-xs text-muted-foreground">
          {character.tagline}
        </p>
      )}

      {/* Footer: Category + Stats */}
      <div className="mt-auto flex items-center justify-between px-4 pb-3 pt-3">
        {category && (
          <span
            className={cn(
              'rounded-full px-2 py-0.5 text-[10px] font-medium',
              category.color
            )}
          >
            {category.emoji} {category.name}
          </span>
        )}
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <HiChatBubbleLeftRight className="size-3.5" />
            {character.usageCount}
          </span>
          <span className="flex items-center gap-1">
            <HiHeart className="size-3.5" />
            {character.likeCount}
          </span>
        </div>
      </div>
    </Link>
  )
})

export { CharacterCard }
