"use client"

import { cn } from "@/app/lib/utils"

interface ChartSkeletonProps {
  height?: number
  className?: string
}

/**
 * Loading skeleton for chart components
 */
export function ChartSkeleton({ height = 300, className }: ChartSkeletonProps) {
  return (
    <div
      className={cn("animate-pulse rounded-lg bg-muted/50", className)}
      style={{ height }}
      role="status"
      aria-label="Loading chart"
    >
      <div className="flex h-full items-center justify-center">
        <div className="flex flex-col items-center gap-2">
          <div className="size-8 animate-spin rounded-full border-4 border-muted-foreground/20 border-t-primary" />
          <span className="text-xs text-muted-foreground">Loading chart...</span>
        </div>
      </div>
    </div>
  )
}

/**
 * Loading skeleton for usage summary section
 */
export function SummarySkeleton() {
  return (
    <div className="space-y-6" role="status" aria-label="Loading usage summary">
      {/* Quota progress bar skeleton */}
      <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
        <div className="animate-pulse space-y-3">
          <div className="flex items-center justify-between">
            <div className="h-4 w-32 rounded bg-muted" />
            <div className="h-4 w-24 rounded bg-muted" />
          </div>
          <div className="h-3 w-full rounded-full bg-muted" />
          <div className="flex items-center justify-between">
            <div className="h-3 w-28 rounded bg-muted" />
            <div className="h-5 w-12 rounded-full bg-muted" />
          </div>
        </div>
      </div>

      {/* Stats cards skeleton */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            // eslint-disable-next-line react/no-array-index-key -- Static skeleton placeholders
            key={`skeleton-stat-${i}`}
            className="rounded-lg border border-border bg-card p-4 shadow-sm"
          >
            <div className="animate-pulse space-y-3">
              <div className="h-4 w-20 rounded bg-muted" />
              <div className="h-8 w-16 rounded bg-muted" />
              <div className="h-3 w-24 rounded bg-muted" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

/**
 * Loading skeleton for the entire dashboard
 */
export function DashboardSkeleton() {
  return (
    <div className="space-y-6" role="status" aria-label="Loading dashboard">
      {/* Header skeleton */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="animate-pulse space-y-2">
          <div className="h-8 w-48 rounded bg-muted" />
          <div className="h-4 w-64 rounded bg-muted" />
        </div>
        <div className="flex items-center gap-2">
          <div className="h-10 w-32 animate-pulse rounded bg-muted" />
          <div className="size-10 animate-pulse rounded bg-muted" />
        </div>
      </div>

      <SummarySkeleton />

      {/* Charts grid skeleton */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            // eslint-disable-next-line react/no-array-index-key -- Static skeleton placeholders
            key={`skeleton-chart-${i}`}
            className="rounded-lg border border-border bg-card shadow-sm"
          >
            <div className="border-b border-border p-4">
              <div className="animate-pulse space-y-2">
                <div className="h-5 w-32 rounded bg-muted" />
                <div className="h-4 w-48 rounded bg-muted" />
              </div>
            </div>
            <div className="p-4">
              <ChartSkeleton height={300} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default ChartSkeleton
