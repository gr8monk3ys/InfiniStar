"use client"

import { type FC, type ReactNode } from "react"

import usePresence from "../hooks/usePresence"

interface PresenceProviderProps {
  children: ReactNode
}

const PresenceProvider: FC<PresenceProviderProps> = ({ children }) => {
  usePresence()
  return <>{children}</>
}

export default PresenceProvider
