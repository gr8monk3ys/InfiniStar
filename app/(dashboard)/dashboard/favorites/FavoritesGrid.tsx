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
      // Optimistic removal
      const prevCharacters = characters
      setCharacters((current) => current.filter((c) => c.id !== characterId))

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
          throw new Error(data.error || "Failed to unlike")
        }

        toast.success("Removed from favorites")
      } catch (error) {
        // Revert on error
        setCharacters(prevCharacters)
        toast.error(error instanceof Error ? error.message : "Failed to remove favorite")
      }
    },
    [characters, token]
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
        <CharacterCard
          key={character.id}
          character={character}
          isLiked={true}
          onUnlike={handleUnlike}
        />
      ))}
    </div>
  )
}
