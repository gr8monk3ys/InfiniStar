import Link from "next/link"

import { cn } from "@/app/lib/utils"
import { buttonVariants } from "@/app/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/app/components/ui/card"
import getCharactersForUser from "@/app/actions/getCharactersForUser"

export const metadata = {
  title: "Characters | InfiniStar",
}

export default async function CharactersPage() {
  const characters = (await getCharactersForUser()) as Array<{
    id: string
    name: string
    slug: string
    tagline: string | null
    isPublic: boolean
    usageCount: number
  }>

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Characters</h1>
          <p className="text-sm text-muted-foreground">Create and manage your AI characters.</p>
        </div>
        <Link href="/dashboard/characters/new" className={cn(buttonVariants())}>
          New Character
        </Link>
      </div>

      {characters.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            You haven't created any characters yet.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {characters.map((character) => (
            <Card key={character.id}>
              <CardHeader>
                <CardTitle className="text-lg">{character.name}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                {character.tagline && <p className="text-muted-foreground">{character.tagline}</p>}
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>{character.isPublic ? "Public" : "Private"}</span>
                  <span>•</span>
                  <span>{character.usageCount} chats</span>
                </div>
                <div className="flex items-center gap-2">
                  <Link
                    href={`/characters/${character.slug}`}
                    className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
                  >
                    View
                  </Link>
                  <Link
                    href={`/dashboard/characters/${character.id}/edit`}
                    className={cn(buttonVariants({ variant: "secondary", size: "sm" }))}
                  >
                    Edit
                  </Link>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
