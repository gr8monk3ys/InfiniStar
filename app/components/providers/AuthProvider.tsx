"use client"

import { createContext, useCallback, useEffect, useMemo, useState } from "react"
import { ClerkProvider, useClerk } from "@clerk/nextjs"
import posthog from "posthog-js"

import {
  getClerkSignInUrl,
  getClerkSignUpUrl,
  isClerkClientConfigured,
  isClerkSatellite,
} from "@/app/lib/clerk-auth"
import { getClientCsrfToken } from "@/app/lib/csrf-client"
import { EMPTY_VIEWER, type SessionViewer } from "@/app/lib/session-viewer"
import { useClerkSessionHint } from "@/app/hooks/useClerkSessionHint"

interface AuthProviderProps {
  children: React.ReactNode
}

type AppAuthMode = "clerk" | "fallback" | null

interface AppAuthUser {
  id: string
  clerkId: string | null
  email: string | null
  image: string | null
  name: string | null
}

interface AppAuthContextValue {
  authMode: AppAuthMode
  isLoaded: boolean
  isSignedIn: boolean
  /**
   * The best guess before `/api/auth/session` has answered, for prerendered
   * pages that want to pick the signed-in layout at hydration instead of
   * flashing the signed-out one: Clerk's `__client_uat` cookie until the
   * session is loaded, `isSignedIn` after. Never a substitute for `isSignedIn`
   * where the answer has to be right.
   */
  isSignedInHint: boolean
  refresh: () => Promise<void>
  signOut: (options?: { redirectUrl?: string }) => Promise<void>
  user: AppAuthUser | null
  userId: string | null
  /**
   * Per-viewer facts the static HTML cannot carry (mature-content access, PRO
   * plan). `EMPTY_VIEWER` until the session confirms them — a page must show
   * the gated, free-plan version until then.
   */
  viewer: SessionViewer
}

interface BaseAuthProviderProps extends AuthProviderProps {
  clerkSignOut?: (redirectUrl: string) => Promise<void>
}

const initialAuthState = {
  authMode: null as AppAuthMode,
  isLoaded: false,
  user: null as AppAuthUser | null,
  viewer: EMPTY_VIEWER,
}

function normalizeViewer(viewer: Partial<SessionViewer> | null | undefined): SessionViewer {
  return {
    canViewMature: viewer?.canViewMature === true,
    isPro: viewer?.isPro === true,
  }
}

export const AppAuthContext = createContext<AppAuthContextValue | null>(null)

function BaseAuthProvider({ children, clerkSignOut }: BaseAuthProviderProps) {
  const [state, setState] = useState(initialAuthState)
  const cookieHint = useClerkSessionHint()

  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/auth/session", {
        cache: "no-store",
        credentials: "include",
      })
      const payload = (await response.json()) as {
        authMode: AppAuthMode
        user: AppAuthUser | null
        viewer?: Partial<SessionViewer> | null
      }

      setState({
        authMode: payload.authMode ?? null,
        isLoaded: true,
        user: payload.user ?? null,
        viewer: payload.user ? normalizeViewer(payload.viewer) : EMPTY_VIEWER,
      })
    } catch {
      setState({
        authMode: null,
        isLoaded: true,
        user: null,
        viewer: EMPTY_VIEWER,
      })
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    if (state.user?.id && posthog.__loaded) {
      posthog.identify(state.user.id)
    }
  }, [state.user?.id])

  const signOut = useCallback(
    async ({ redirectUrl = "/" }: { redirectUrl?: string } = {}) => {
      if (posthog.__loaded) {
        posthog.reset()
      }

      if (state.authMode === "fallback") {
        const csrfToken = await getClientCsrfToken()

        await fetch("/api/auth/fallback/sign-out", {
          body: JSON.stringify({}),
          credentials: "include",
          headers: csrfToken
            ? {
                "Content-Type": "application/json",
                "X-CSRF-Token": csrfToken,
              }
            : {
                "Content-Type": "application/json",
              },
          method: "POST",
        })

        setState({
          authMode: null,
          isLoaded: true,
          user: null,
          viewer: EMPTY_VIEWER,
        })

        window.location.assign(redirectUrl)
        return
      }

      if (clerkSignOut) {
        await clerkSignOut(redirectUrl)
        return
      }

      window.location.assign(redirectUrl)
    },
    [clerkSignOut, state.authMode]
  )

  const value = useMemo<AppAuthContextValue>(
    () => ({
      authMode: state.authMode,
      isLoaded: state.isLoaded,
      isSignedIn: Boolean(state.user),
      isSignedInHint: state.isLoaded ? Boolean(state.user) : cookieHint === "signed-in",
      refresh,
      signOut,
      user: state.user,
      userId: state.user?.id ?? null,
      viewer: state.viewer,
    }),
    [cookieHint, refresh, signOut, state.authMode, state.isLoaded, state.user, state.viewer]
  )

  return <AppAuthContext.Provider value={value}>{children}</AppAuthContext.Provider>
}

function ClerkBackedAuthProvider({ children }: AuthProviderProps) {
  const clerk = useClerk()
  const signOut = useCallback(
    async (redirectUrl: string) => {
      await clerk.signOut({ redirectUrl })
    },
    [clerk]
  )

  return <BaseAuthProvider clerkSignOut={signOut}>{children}</BaseAuthProvider>
}

export function AuthProvider({ children }: AuthProviderProps) {
  const isSatellite = isClerkSatellite()
  const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY

  if (!isClerkClientConfigured() || !publishableKey) {
    return <BaseAuthProvider>{children}</BaseAuthProvider>
  }

  return (
    <ClerkProvider
      publishableKey={publishableKey}
      {...(isSatellite
        ? {
            domain: (url: URL) => url.host,
            isSatellite: true,
          }
        : {
            proxyUrl: process.env.NEXT_PUBLIC_CLERK_PROXY_URL,
          })}
      signInUrl={getClerkSignInUrl()}
      signUpUrl={getClerkSignUpUrl()}
    >
      <ClerkBackedAuthProvider>{children}</ClerkBackedAuthProvider>
    </ClerkProvider>
  )
}
