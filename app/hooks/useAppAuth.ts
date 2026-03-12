"use client"

import { useContext } from "react"

import { AppAuthContext } from "@/app/components/providers/AuthProvider"

export function useAppAuth() {
  const context = useContext(AppAuthContext)

  if (!context) {
    throw new Error("useAppAuth must be used within an AuthProvider")
  }

  return context
}
