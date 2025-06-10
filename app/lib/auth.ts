import { auth, currentUser } from "@clerk/nextjs/server"

import {
  getFallbackSessionByToken,
  getFallbackSessionTokenFromCookies,
  isFallbackAuthEnabled,
} from "@/app/lib/fallback-auth"
import prisma from "@/app/lib/prismadb"

export type AuthMode = "clerk" | "fallback"

export interface AppAuthSessionUser {
  id: string
  clerkId: string | null
  email: string | null
  name: string | null
  image: string | null
}

export interface AppAuthSession {
  authMode: AuthMode
  user: AppAuthSessionUser
}

function isClerkConfiguredOnServer() {
  return Boolean(process.env.CLERK_SECRET_KEY && process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY)
}

async function getClerkSession(): Promise<AppAuthSession | null> {
  if (!isClerkConfiguredOnServer()) {
    return null
  }

  try {
    const { userId } = await auth()

    if (!userId) {
      return null
    }

    const databaseUser = await prisma.user.findUnique({
      where: {
        clerkId: userId,
      },
      select: {
        id: true,
        clerkId: true,
        email: true,
        name: true,
        image: true,
      },
    })

    if (databaseUser) {
      return {
        authMode: "clerk",
        user: databaseUser,
      }
    }

    const clerkUser = await currentUser()

    if (!clerkUser) {
      return null
    }

    return {
      authMode: "clerk",
      user: {
        id: userId,
        clerkId: userId,
        email: clerkUser.emailAddresses[0]?.emailAddress ?? null,
        name: clerkUser.firstName
          ? `${clerkUser.firstName} ${clerkUser.lastName || ""}`.trim()
          : null,
        image: clerkUser.imageUrl,
      },
    }
  } catch {
    return null
  }
}

async function getFallbackSession(): Promise<AppAuthSession | null> {
  if (!isFallbackAuthEnabled()) {
    return null
  }

  const sessionToken = await getFallbackSessionTokenFromCookies()
  if (!sessionToken) {
    return null
  }

  const fallbackSession = await getFallbackSessionByToken(sessionToken)
  if (!fallbackSession) {
    return null
  }

  return {
    authMode: "fallback",
    user: {
      id: fallbackSession.user.id,
      clerkId: fallbackSession.user.clerkId,
      email: fallbackSession.user.email,
      name: fallbackSession.user.name,
      image: fallbackSession.user.image,
    },
  }
}

export async function getAuthSession(): Promise<AppAuthSession | null> {
  const clerkSession = await getClerkSession()
  if (clerkSession) {
    return clerkSession
  }

  return getFallbackSession()
}

export async function getCurrentUserId() {
  const session = await getAuthSession()
  return session?.user.id ?? null
}
