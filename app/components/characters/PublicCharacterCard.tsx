import { CharacterCardFrame, type CharacterCardData } from "./CharacterCardFrame"

interface PublicCharacterCardProps {
  character: CharacterCardData
  imagePriority?: boolean
  sizes?: string
}

export function PublicCharacterCard({ character, imagePriority, sizes }: PublicCharacterCardProps) {
  return <CharacterCardFrame character={character} imagePriority={imagePriority} sizes={sizes} />
}
