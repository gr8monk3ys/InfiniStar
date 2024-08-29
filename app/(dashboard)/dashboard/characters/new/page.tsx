import { CharacterForm } from "@/app/components/characters/CharacterForm"

export default function NewCharacterPage() {
  return (
    <div className="p-6">
      <CharacterForm mode="create" />
    </div>
  )
}
