import { getAuthSession } from "@/app/lib/auth"

export default async function getSession() {
  const session = await getAuthSession()

  if (!session) {
    return null
  }

  return {
    authMode: session.authMode,
    user: {
      id: session.user.id,
      email: session.user.email,
      name: session.user.name,
      image: session.user.image,
    },
  }
}
