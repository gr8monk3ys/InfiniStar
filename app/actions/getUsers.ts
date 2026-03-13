import prisma from "@/app/lib/prismadb"

import getSession from "./getSession"

const getUsers = async () => {
  const session = await getSession()

  if (!session?.user?.email) {
    return []
  }

  try {
    const users = await prisma.user.findMany({
      orderBy: {
        createdAt: "desc",
      },
      take: 200,
      where: {
        NOT: {
          email: session.user.email,
        },
      },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        createdAt: true,
      },
    })

    return users
  } catch {
    return []
  }
}

export default getUsers
