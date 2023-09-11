"use client"

import dynamic from "next/dynamic"

/**
 * Skeleton placeholder displayed while prism-react-renderer (~30KB) is loading.
 * Mimics the CodeBlock layout with a header bar and content area.
 */
const CodeBlockSkeleton = (): React.ReactElement => (
  <div className="my-4 overflow-hidden rounded-lg border border-border" aria-hidden="true">
    <div className="flex items-center justify-between border-b border-border bg-muted/50 px-4 py-2">
      <div className="h-3 w-16 animate-pulse rounded bg-muted" />
      <div className="h-6 w-14 animate-pulse rounded bg-muted" />
    </div>
    <div className="space-y-2 p-4">
      <div className="h-3 w-3/4 animate-pulse rounded bg-muted" />
      <div className="h-3 w-1/2 animate-pulse rounded bg-muted" />
      <div className="h-3 w-2/3 animate-pulse rounded bg-muted" />
    </div>
  </div>
)

/**
 * Lazy-loaded CodeBlock using next/dynamic.
 * Keeps prism-react-renderer (~30KB) out of the initial page load.
 * Code blocks only render when AI messages contain fenced code.
 */
export const LazyCodeBlock = dynamic(
  () => import("./CodeBlock").then((mod) => ({ default: mod.CodeBlock })),
  {
    loading: CodeBlockSkeleton,
    ssr: false,
  }
)
