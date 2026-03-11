"use client"

import { ClerkProvider } from "@clerk/nextjs"

interface AuthProviderProps {
  children: React.ReactNode
}

export function AuthProvider({ children }: AuthProviderProps) {
  return <ClerkProvider>{children}</ClerkProvider>
}
