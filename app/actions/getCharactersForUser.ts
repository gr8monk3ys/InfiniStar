import prisma from "@/app/lib/prismadb"
import getCurrentUser from "@/app/actions/getCurrentUser"

export default async function getCharactersForUser() {
  const currentUser = await getCurrentUser()
  if (!currentUser?.id) {
    return []
  }

  return prisma.character.findMany({
    where: { createdById: currentUser.id },
    orderBy: { updatedAt: "desc" },
  })
}
