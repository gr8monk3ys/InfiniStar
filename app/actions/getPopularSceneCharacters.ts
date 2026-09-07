import { matureAccess } from "@/app/lib/nsfw"
import prisma from "@/app/lib/prismadb"
import type { SceneCharacterOption } from "@/app/(dashboard)/dashboard/conversations/types"

interface SceneCharactersUser {
  isAdult?: boolean | null
  nsfwEnabled?: boolean | null
  adultConfirmedAt?: Date | null
}

export default async function getPopularSceneCharacters(
  currentUser?: SceneCharactersUser | null
): Promise<SceneCharacterOption[]> {
  const access = matureAccess(currentUser)

  return prisma.character.findMany({
    where: {
      isPublic: true,
      ...access.visibilityFilter,
    },
    orderBy: [{ featured: "desc" }, { usageCount: "desc" }, { createdAt: "desc" }],
    take: 50,
    select: {
      id: true,
      name: true,
      tagline: true,
      avatarUrl: true,
    },
  })
}
