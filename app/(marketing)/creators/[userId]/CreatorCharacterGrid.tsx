import { PublicCharacterCard } from "@/app/components/characters/PublicCharacterCard"

export interface CreatorCharacter {
  id: string
  slug: string
  name: string
  tagline: string | null
  avatarUrl: string | null
  category: string
  usageCount: number
  likeCount: number
  isNsfw?: boolean
  createdBy: {
    id: string
    name: string | null
    image: string | null
  } | null
}

/**
 * The creator's public characters. Rendered by the cached page with the SFW
 * set, and again by `actions.tsx` with the viewer's full set once the session
 * confirms they may see mature characters.
 */
export function CreatorCharacterGrid({ characters }: { characters: CreatorCharacter[] }) {
  return (
    <div>
      <h2 className="mb-4 text-lg font-semibold">
        Characters <span className="tabular-nums">({characters.length})</span>
      </h2>
      {characters.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-12 text-center">
          <p className="text-sm text-muted-foreground">No public characters yet.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {/*
            A creator's catalog is unbounded. Off-screen cards skip layout and
            paint until they scroll near the viewport; `auto` remembers each
            card's real height once it has rendered. Content-visibility also
            clips paint to the box, so the wrapper carries a padded margin the
            card's hover lift and shadow can draw into without moving layout.
          */}
          {characters.map((character) => (
            <div
              key={character.id}
              className="-m-4 grid p-4 [contain-intrinsic-size:auto_28rem] [content-visibility:auto]"
            >
              <PublicCharacterCard character={character} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
