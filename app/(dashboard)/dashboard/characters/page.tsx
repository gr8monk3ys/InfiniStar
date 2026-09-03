import Link from "next/link"

import { cn } from "@/app/lib/utils"
import { buttonVariants } from "@/app/components/ui/button"
import getCharactersForUser from "@/app/actions/getCharactersForUser"
import { CharacterCardFrame } from "@/app/components/characters/CharacterCardFrame"

export const dynamic = "force-dynamic"

export const metadata = {
  title: "Characters | InfiniStar",
}

export default async function CharactersPage() {
  const characters = (await getCharactersForUser()) as Array<{
    id: string
    name: string
    slug: string
    tagline: string | null
    avatarUrl: string | null
    category: string
    isPublic: boolean
    isNsfw: boolean
    usageCount: number
    likeCount: number
    commentCount: number
  }>

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Your characters</h1>
          <p className="text-sm text-muted-foreground">
            Each card here looks exactly the way it does on Explore.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/dashboard/characters/import"
            className={cn(buttonVariants({ variant: "outline" }))}
          >
            Import
          </Link>
          <Link href="/dashboard/characters/new" className={cn(buttonVariants())}>
            New character
          </Link>
        </div>
      </div>

      {characters.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border/60 px-6 py-16 text-center">
          <p className="text-sm font-medium">No characters yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Make your first one. It takes a name, a face and a voice.
          </p>
          <Link
            href="/dashboard/characters/new"
            className={cn(buttonVariants({ size: "sm" }), "mt-4")}
          >
            Create a character
          </Link>
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {characters.map((character) => (
            <li key={character.id} className="flex flex-col gap-2">
              <CharacterCardFrame
                character={{
                  id: character.id,
                  slug: character.slug,
                  name: character.name,
                  tagline: character.tagline,
                  avatarUrl: character.avatarUrl,
                  category: character.category,
                  usageCount: character.usageCount,
                  likeCount: character.likeCount,
                  commentCount: character.commentCount,
                  isNsfw: character.isNsfw,
                }}
                action={
                  !character.isPublic ? (
                    <span className="absolute right-2 top-2 rounded-full bg-black/50 px-2 py-0.5 text-xs font-semibold text-white/90 backdrop-blur-sm">
                      Only you
                    </span>
                  ) : undefined
                }
              />
              <div className="flex items-center justify-between gap-2 px-0.5">
                <span className="text-xs text-muted-foreground">
                  {character.isPublic ? "Public" : "Private"} · {character.usageCount}{" "}
                  {character.usageCount === 1 ? "chat" : "chats"}
                </span>
                <Link
                  href={`/dashboard/characters/${character.id}/edit`}
                  className={cn(buttonVariants({ variant: "outline", size: "sm" }), "h-8")}
                  aria-label={`Edit ${character.name}`}
                >
                  Edit
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
