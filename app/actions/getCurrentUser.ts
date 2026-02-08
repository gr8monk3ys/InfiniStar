import { auth } from "@clerk/nextjs/server"

import prisma from "@/app/lib/prismadb"

const getCurrentUser = async () => {
  try {
    const { userId } = await auth()

    if (!userId) {
      return null
    }

    const currentUser = await prisma.user.findUnique({
      where: {
        clerkId: userId,
      },
    })

    if (!currentUser) {
      return null
    }

    return currentUser
  } catch {
    return null
  }
}

export default getCurrentUser
