"use client"

import { useCallback, useState } from "react"
import toast from "react-hot-toast"

import { CharacterCard } from "@/app/components/characters/CharacterCard"
import { useCsrfToken } from "@/app/hooks/useCsrfToken"

interface FavoriteCharacter {
  id: string
  slug: string
  name: string
  tagline: string | null
  avatarUrl: string | null
  category: string
  usageCount: number
  likeCount: number
  commentCount?: number
  isNsfw?: boolean
  likedAt: Date
  createdBy: {
    id: string
    name: string | null
    image: string | null
  } | null
}

interface FavoritesGridProps {
  characters: FavoriteCharacter[]
}

export default function FavoritesGrid({ characters: initialCharacters }: FavoritesGridProps) {
  const [characters, setCharacters] = useState<FavoriteCharacter[]>(initialCharacters)
  const { token } = useCsrfToken()

  const handleUnlike = useCallback(
    async (characterId: string): Promise<void> => {
      // Optimistic removal. The removed card and its position are captured from the
      // updater so the callback does not depend on (and re-create with) the list.
      let removed: { character: FavoriteCharacter; index: number } | null = null
      setCharacters((current) => {
        const index = current.findIndex((c) => c.id === characterId)
        if (index === -1) return current
        removed = { character: current[index], index }
        return current.filter((c) => c.id !== characterId)
      })

      try {
        const res = await fetch(`/api/characters/${characterId}/like`, {
          method: "DELETE",
          headers: {
            "X-CSRF-Token": token || "",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({}),
        })

        if (!res.ok) {
          const data = await res.json()
          throw new Error(data.error || "Couldn't remove from favorites. Try again.")
        }

        toast.success("Removed from favorites")
      } catch (error) {
        // Revert on error: put the card back where it was.
        const restore = removed as { character: FavoriteCharacter; index: number } | null
        if (restore) {
          setCharacters((current) =>
            current.some((c) => c.id === restore.character.id)
              ? current
              : current.toSpliced(restore.index, 0, restore.character)
          )
        }
        toast.error(
          error instanceof Error ? error.message : "Couldn't remove from favorites. Try again."
        )
      }
    },
    [token]
  )

  if (characters.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        All favorites removed. Explore characters to add more.
      </p>
    )
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {characters.map((character) => (
        // The list is unbounded: let the browser skip off-screen cards.
        <div
          key={character.id}
          className="[contain-intrinsic-size:auto_320px] [content-visibility:auto]"
        >
          <CharacterCard character={character} isLiked={true} onUnlike={handleUnlike} />
        </div>
      ))}
    </div>
  )
}
