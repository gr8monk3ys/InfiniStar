"use client"

import { memo } from "react"
import { HiHeart, HiOutlineHeart } from "react-icons/hi2"

import { cn } from "@/app/lib/utils"

import { CharacterCardFrame, type CharacterCardData } from "./CharacterCardFrame"

interface CharacterCardProps {
  character: CharacterCardData
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
    <CharacterCardFrame
      character={character}
      action={
        (onLike || onUnlike) && (
          <button
            type="button"
            onClick={handleLikeClick}
            className={cn(
              "absolute right-2 top-2 rounded-full p-1.5 backdrop-blur-sm transition-colors",
              isLiked
                ? "bg-red-500/20 text-red-500 hover:bg-red-500/30"
                : "bg-black/30 text-white/70 hover:bg-black/50 hover:text-white"
            )}
            aria-label={isLiked ? "Unlike character" : "Like character"}
          >
            {isLiked ? (
              <HiHeart className="size-5" aria-hidden="true" />
            ) : (
              <HiOutlineHeart className="size-5" aria-hidden="true" />
            )}
          </button>
        )
      }
    />
  )
})

export { CharacterCard }
