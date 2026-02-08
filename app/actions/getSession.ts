import { auth, currentUser } from "@clerk/nextjs/server"

export default async function getSession() {
  const { userId } = await auth()

  if (!userId) {
    return null
  }

  const user = await currentUser()

  if (!user) {
    return null
  }

  return {
    user: {
      id: userId,
      email: user.emailAddresses[0]?.emailAddress,
      name: user.firstName ? `${user.firstName} ${user.lastName || ""}`.trim() : null,
      image: user.imageUrl,
    },
  }
}
