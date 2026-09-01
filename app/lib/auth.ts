import { auth, currentUser } from "@clerk/nextjs/server"
import { createClerkAuth, isClerkConfigured, setClerkModule } from "@gr8monk3ys/next-kit/auth/clerk"

import {
  getFallbackSessionByToken,
  getFallbackSessionTokenFromCookies,
  isFallbackAuthEnabled,
} from "@/app/lib/fallback-auth"
import prisma from "@/app/lib/prismadb"

// Hand Clerk to the kit explicitly rather than letting it resolve
// `@clerk/nextjs/server` itself, so the module this file imports is the module
// the guards use.
setClerkModule({ auth })

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

/**
 * Resolve a Clerk user id into this app's session shape.
 *
 * Prefers the local user row; when Clerk knows the user but we have no row yet
 * (first request after sign-up, before the webhook lands), synthesises a session
 * from Clerk's own profile so the request is not treated as signed out.
 */
const clerkAuth = createClerkAuth<AppAuthSession>({
  resolveUser: async (userId) => {
    try {
      const databaseUser = await prisma.user.findUnique({
        where: { clerkId: userId },
        select: { id: true, clerkId: true, email: true, name: true, image: true },
      })

      if (databaseUser) {
        return { authMode: "clerk", user: databaseUser }
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
  },
})

async function getClerkSession(): Promise<AppAuthSession | null> {
  if (!isClerkConfigured()) {
    return null
  }

  return clerkAuth.getUserOrNull()
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
