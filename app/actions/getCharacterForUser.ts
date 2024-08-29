import prisma from "@/app/lib/prismadb"
import getCurrentUser from "@/app/actions/getCurrentUser"

export default async function getCharacterForUser(characterId: string) {
  const currentUser = await getCurrentUser()
  if (!currentUser?.id) {
    return null
  }

  return prisma.character.findFirst({
    where: {
      id: characterId,
      createdById: currentUser.id,
    },
  })
}
