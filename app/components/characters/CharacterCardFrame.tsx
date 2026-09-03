import Image from "next/image"
import Link from "next/link"
import { HiChatBubbleBottomCenterText, HiChatBubbleLeftRight, HiHeart } from "react-icons/hi2"

import { getCategoryById } from "@/app/lib/character-categories"
import { characterPortrait } from "@/app/lib/character-portrait"
import { cn } from "@/app/lib/utils"

export interface CharacterCardData {
  id: string
  slug: string
  name: string
  tagline?: string | null
  avatarUrl?: string | null
  category: string
  usageCount: number
  likeCount: number
  commentCount?: number
  isNsfw?: boolean
  createdBy?: {
    id: string
    name: string | null
    image: string | null
  } | null
}

interface CharacterCardFrameProps {
  character: CharacterCardData
  action?: React.ReactNode
  imagePriority?: boolean
  sizes?: string
  /** Skip next/image optimisation (for previews of URLs outside the configured hosts). */
  unoptimizedImage?: boolean
}

export function CharacterCardFrame({
  character,
  action,
  imagePriority = false,
  unoptimizedImage = false,
  sizes = "(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw",
}: CharacterCardFrameProps) {
  const category = getCategoryById(character.category)
  const portrait = characterPortrait(character)
  // A row of 0 · 0 · 0 tells a visitor nothing; the category tag is more useful there.
  const hasEngagement =
    character.usageCount > 0 || character.likeCount > 0 || (character.commentCount ?? 0) > 0

  return (
    <Link
      href={`/characters/${character.slug}`}
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-xl border border-border/50",
        "bg-card transition-all duration-300",
        "hover:-translate-y-1 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/10"
      )}
    >
      <div className="relative aspect-[3/4] w-full overflow-hidden bg-muted">
        {character.avatarUrl ? (
          <Image
            src={character.avatarUrl}
            alt={character.name}
            fill
            priority={imagePriority}
            unoptimized={unoptimizedImage}
            className="object-cover transition-transform duration-300 group-hover:scale-105"
            sizes={sizes}
          />
        ) : (
          <div
            className="grain relative flex h-full w-full items-center justify-center"
            style={{ backgroundImage: portrait.backgroundImage }}
          >
            <span className="font-heading text-5xl font-bold text-white/90">
              {portrait.initial}
            </span>
          </div>
        )}

        <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/60 to-transparent" />

        {character.isNsfw && (
          <span className="absolute left-2 top-2 rounded-full bg-red-600/80 px-2 py-0.5 text-xs font-semibold text-white backdrop-blur-sm">
            NSFW
          </span>
        )}

        <div className="absolute bottom-2 left-2 flex items-center gap-2">
          {hasEngagement ? (
            <>
              <span className="flex items-center gap-1 rounded-full bg-black/50 px-2 py-0.5 text-xs text-white/90 backdrop-blur-sm">
                <HiChatBubbleLeftRight className="size-3" />
                {character.usageCount}
              </span>
              <span className="flex items-center gap-1 rounded-full bg-black/50 px-2 py-0.5 text-xs text-white/90 backdrop-blur-sm">
                <HiHeart className="size-3" />
                {character.likeCount}
              </span>
              {typeof character.commentCount === "number" && (
                <span className="flex items-center gap-1 rounded-full bg-black/50 px-2 py-0.5 text-xs text-white/90 backdrop-blur-sm">
                  <HiChatBubbleBottomCenterText className="size-3" />
                  {character.commentCount}
                </span>
              )}
            </>
          ) : (
            category && (
              <span className="rounded-full bg-black/50 px-2 py-0.5 text-xs font-medium text-white/90 backdrop-blur-sm">
                {category.emoji} {category.name}
              </span>
            )
          )}
        </div>

        {action}
      </div>

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

        {category && hasEngagement && (
          <div className="mt-auto pt-2">
            <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", category.color)}>
              {category.emoji} {category.name}
            </span>
          </div>
        )}
      </div>
    </Link>
  )
}
