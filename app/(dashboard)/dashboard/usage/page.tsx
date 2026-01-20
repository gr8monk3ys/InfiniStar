import type { Metadata } from "next"

import UsageDashboard from "./components/UsageDashboard"

export const metadata: Metadata = {
  title: "AI Usage Dashboard | InfiniStar",
  description: "View your AI usage statistics, trends, and analytics",
}

export default function UsagePage() {
  return (
    <div className="h-full lg:pl-80">
      <div className="flex h-full flex-col overflow-auto">
        <main className="flex-1 p-4 sm:p-6 lg:p-8">
          <UsageDashboard />
        </main>
      </div>
    </div>
  )
}
