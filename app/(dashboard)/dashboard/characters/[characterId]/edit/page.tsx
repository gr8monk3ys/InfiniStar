import { notFound } from "next/navigation"

import getCharacterForUser from "@/app/actions/getCharacterForUser"
import { CharacterForm } from "@/app/components/characters/CharacterForm"

interface EditCharacterPageProps {
  params: Promise<{ characterId: string }>
}

export default async function EditCharacterPage({ params }: EditCharacterPageProps) {
  const { characterId } = await params
  const character = await getCharacterForUser(characterId)

  if (!character) {
    notFound()
  }

  return (
    <div className="p-6">
      <CharacterForm
        mode="edit"
        initial={{
          id: character.id,
          slug: character.slug,
          name: character.name,
          tagline: character.tagline || "",
          description: character.description || "",
          greeting: character.greeting || "",
          systemPrompt: character.systemPrompt,
          avatarUrl: character.avatarUrl || "",
          coverImageUrl: character.coverImageUrl || "",
          isPublic: character.isPublic,
          tags: character.tags.join(", "),
        }}
      />
    </div>
  )
}
