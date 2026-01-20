"use client"

import dynamic from "next/dynamic"

// Loading placeholder for charts
const ChartSkeleton = () => <div className="h-[300px] w-full animate-pulse rounded-lg bg-muted" />

/**
 * Lazy-loaded chart components using Next.js dynamic imports
 * This code-splits Recharts (~200KB) and only loads it when charts are rendered
 */

export const LazyUsageLineChart = dynamic(
  () => import("./UsageLineChart").then((mod) => ({ default: mod.UsageLineChart })),
  {
    loading: ChartSkeleton,
    ssr: false,
  }
)

export const LazyModelPieChart = dynamic(
  () => import("./ModelPieChart").then((mod) => ({ default: mod.ModelPieChart })),
  {
    loading: ChartSkeleton,
    ssr: false,
  }
)

export const LazyPersonalityBarChart = dynamic(
  () => import("./PersonalityBarChart").then((mod) => ({ default: mod.PersonalityBarChart })),
  {
    loading: ChartSkeleton,
    ssr: false,
  }
)

export const LazyUsageHeatmap = dynamic(
  () => import("./UsageHeatmap").then((mod) => ({ default: mod.UsageHeatmap })),
  {
    loading: ChartSkeleton,
    ssr: false,
  }
)
