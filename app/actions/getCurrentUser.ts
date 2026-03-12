import { getAuthSession } from "@/app/lib/auth"
import prisma from "@/app/lib/prismadb"

const getCurrentUser = async () => {
  try {
    const session = await getAuthSession()
    if (!session?.user?.id) {
      return null
    }

    return prisma.user.findUnique({
      where: {
        id: session.user.id,
      },
    })
  } catch {
    return null
  }
}

export default getCurrentUser
