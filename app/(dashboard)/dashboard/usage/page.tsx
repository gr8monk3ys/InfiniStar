import { Suspense } from "react"
import type { Metadata } from "next"

import { DashboardSkeleton } from "./components/LoadingSkeletons"
import UsageDashboard from "./components/UsageDashboard"

export const metadata: Metadata = {
  title: "AI Usage Dashboard | InfiniStar",
  description: "View your AI usage statistics, trends, and analytics",
}

export default function UsagePage() {
  return (
    <div className="h-full lg:pl-80">
      <div className="flex h-full flex-col overflow-auto">
        {/* The root layout already provides the page's <main> landmark. */}
        <div className="flex-1 p-4 sm:p-6 lg:p-8">
          {/* UsageDashboard reads the selected period from useSearchParams. */}
          <Suspense fallback={<DashboardSkeleton />}>
            <UsageDashboard />
          </Suspense>
        </div>
      </div>
    </div>
  )
}
