"use client"

import type { ReactNode } from "react"
import { HiArrowDown, HiArrowUp, HiMinus } from "react-icons/hi"

import { cn } from "@/app/lib/utils"

interface UsageCardProps {
  title: string
  value: string | number
  subtitle?: string
  icon?: ReactNode
  trend?: {
    value: number
    label?: string
  }
  className?: string
  loading?: boolean
}

/**
 * Stat card component for displaying usage metrics
 */
export function UsageCard({
  title,
  value,
  subtitle,
  icon,
  trend,
  className,
  loading = false,
}: UsageCardProps) {
  // Determine trend direction and color
  const getTrendDisplay = () => {
    if (!trend) return null

    const { value: trendValue, label } = trend
    const isPositive = trendValue > 0
    const isNegative = trendValue < 0
    const isNeutral = trendValue === 0

    const Icon = isPositive ? HiArrowUp : isNegative ? HiArrowDown : HiMinus
    const colorClass = isPositive
      ? "text-green-600 dark:text-green-400"
      : isNegative
        ? "text-red-600 dark:text-red-400"
        : "text-muted-foreground"

    return (
      <div className={cn("flex items-center gap-1 text-xs", colorClass)}>
        <Icon className="size-3" aria-hidden="true" />
        <span>
          {isNeutral ? "0" : isPositive ? `+${trendValue}` : trendValue}%
          {label && <span className="text-muted-foreground"> {label}</span>}
        </span>
      </div>
    )
  }

  if (loading) {
    return (
      <div className={cn("rounded-lg border border-border bg-card p-4 shadow-sm", className)}>
        <div className="animate-pulse space-y-3">
          <div className="h-4 w-24 rounded bg-muted" />
          <div className="h-8 w-16 rounded bg-muted" />
          <div className="h-3 w-20 rounded bg-muted" />
        </div>
      </div>
    )
  }

  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-card p-4 shadow-sm transition-colors hover:bg-accent/5",
        className
      )}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <p className="mt-2 text-2xl font-bold text-card-foreground sm:text-3xl">
            {typeof value === "number" ? value.toLocaleString() : value}
          </p>
          {(subtitle || trend) && (
            <div className="mt-1 flex items-center gap-2">
              {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
              {getTrendDisplay()}
            </div>
          )}
        </div>
        {icon && <div className="rounded-lg bg-primary/10 p-2 text-primary">{icon}</div>}
      </div>
    </div>
  )
}

export default UsageCard
