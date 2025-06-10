"use client"

import { useEffect, useState } from "react"

type RechartsModule = typeof import("recharts")

let rechartsModulePromise: Promise<RechartsModule> | null = null

function loadRechartsModule() {
  if (!rechartsModulePromise) {
    rechartsModulePromise = import("recharts")
  }

  return rechartsModulePromise
}

export function useRechartsModule() {
  const [rechartsModule, setRechartsModule] = useState<RechartsModule | null>(null)

  useEffect(() => {
    let isMounted = true

    loadRechartsModule().then((loadedModule) => {
      if (isMounted) {
        setRechartsModule(loadedModule)
      }
    })

    return () => {
      isMounted = false
    }
  }, [])

  return rechartsModule
}

interface ChartLoadingStateProps {
  ariaLabel: string
  className?: string
}

export function ChartLoadingState({ ariaLabel, className }: ChartLoadingStateProps) {
  return (
    <div className={className} role="img" aria-label={ariaLabel} aria-busy="true">
      <div className="h-full w-full animate-pulse rounded-lg bg-muted/40" />
    </div>
  )
}
