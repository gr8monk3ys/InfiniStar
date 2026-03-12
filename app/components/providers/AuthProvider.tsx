"use client"

import { createContext, useCallback, useEffect, useMemo, useState } from "react"
import { ClerkProvider, useClerk } from "@clerk/nextjs"

import {
  getClerkSignInUrl,
  getClerkSignUpUrl,
  isClerkClientConfigured,
  isClerkSatellite,
} from "@/app/lib/clerk-auth"
import { getClientCsrfToken } from "@/app/lib/csrf-client"

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
  refresh: () => Promise<void>
  signOut: (options?: { redirectUrl?: string }) => Promise<void>
  user: AppAuthUser | null
  userId: string | null
}

interface BaseAuthProviderProps extends AuthProviderProps {
  clerkSignOut?: (redirectUrl: string) => Promise<void>
}

const initialAuthState = {
  authMode: null as AppAuthMode,
  isLoaded: false,
  user: null as AppAuthUser | null,
}

export const AppAuthContext = createContext<AppAuthContextValue | null>(null)

function BaseAuthProvider({ children, clerkSignOut }: BaseAuthProviderProps) {
  const [state, setState] = useState(initialAuthState)

  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/auth/session", {
        cache: "no-store",
        credentials: "include",
      })
      const payload = (await response.json()) as {
        authMode: AppAuthMode
        user: AppAuthUser | null
      }

      setState({
        authMode: payload.authMode ?? null,
        isLoaded: true,
        user: payload.user ?? null,
      })
    } catch {
      setState({
        authMode: null,
        isLoaded: true,
        user: null,
      })
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const signOut = useCallback(
    async ({ redirectUrl = "/" }: { redirectUrl?: string } = {}) => {
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
      refresh,
      signOut,
      user: state.user,
      userId: state.user?.id ?? null,
    }),
    [refresh, signOut, state.authMode, state.isLoaded, state.user]
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
