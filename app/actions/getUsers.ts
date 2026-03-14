import prisma from "@/app/lib/prismadb"

import getSession from "./getSession"

const PAGE_SIZE = 50

const getUsers = async (cursor?: string) => {
  const session = await getSession()

  if (!session?.user?.email) {
    return { users: [], nextCursor: undefined }
  }

  try {
    const users = await prisma.user.findMany({
      orderBy: {
        createdAt: "desc",
      },
      take: PAGE_SIZE + 1,
      ...(cursor && {
        cursor: { id: cursor },
        skip: 1,
      }),
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

    const hasMore = users.length > PAGE_SIZE
    const nextCursor = hasMore ? users[PAGE_SIZE - 1].id : undefined

    return {
      users: hasMore ? users.slice(0, PAGE_SIZE) : users,
      nextCursor,
    }
  } catch {
    return { users: [], nextCursor: undefined }
  }
}

export default getUsers
