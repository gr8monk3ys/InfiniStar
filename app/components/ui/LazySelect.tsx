"use client"

import type { ComponentType } from "react"
import dynamic from "next/dynamic"
import type { GroupBase, Props as SelectProps } from "react-select"

/**
 * Skeleton placeholder displayed while react-select (~45KB) is loading.
 */
const SelectSkeleton = (): React.ReactElement => (
  <div className="h-10 w-full animate-pulse rounded-md bg-muted" aria-hidden="true" />
)

/**
 * Lazy-loaded react-select using next/dynamic.
 * Keeps the ~45KB react-select bundle out of the initial page load.
 *
 * Usage: import { LazySelect } from '@/app/components/ui/LazySelect'
 */
export const LazySelect = dynamic(() => import("react-select"), {
  loading: SelectSkeleton,
  ssr: false,
}) as ComponentType<SelectProps<unknown, boolean, GroupBase<unknown>>>

export const LazyCreatableSelect = dynamic(() => import("react-select/creatable"), {
  loading: SelectSkeleton,
  ssr: false,
})
