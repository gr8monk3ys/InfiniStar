import { NextResponse, type NextRequest } from "next/server"

import { checkUsageQuota, getUsageByDateRange, getUserUsageStats } from "@/app/lib/ai-usage"
import getCurrentUser from "@/app/actions/getCurrentUser"

/**
 * GET /api/ai/usage
 *
 * Retrieves AI usage statistics for the current user
 *
 * Query parameters:
 * - startDate: ISO date string (optional)
 * - endDate: ISO date string (optional)
 * - conversationId: Filter by specific conversation (optional)
 * - period: "day" | "week" | "month" | "all" (default: "month")
 */
export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser()

    if (!currentUser?.id) {
      return new NextResponse("Unauthorized", { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const period = searchParams.get("period") || "month"
    const conversationId = searchParams.get("conversationId") || undefined

    let startDate: Date | undefined
    let endDate: Date | undefined

    // Calculate date range based on period
    const now = new Date()
    endDate = now

    switch (period) {
      case "day":
        startDate = new Date(now)
        startDate.setDate(startDate.getDate() - 1)
        break
      case "week":
        startDate = new Date(now)
        startDate.setDate(startDate.getDate() - 7)
        break
      case "month":
        startDate = new Date(now)
        startDate.setMonth(startDate.getMonth() - 1)
        break
      case "all":
        startDate = undefined
        endDate = undefined
        break
      default:
        // Custom date range from query params
        const startParam = searchParams.get("startDate")
        const endParam = searchParams.get("endDate")
        if (startParam) startDate = new Date(startParam)
        if (endParam) endDate = new Date(endParam)
    }

    // Get usage stats
    const { usage, stats } = await getUserUsageStats(currentUser.id, {
      startDate,
      endDate,
      conversationId,
    })

    // Get daily breakdown if requested
    let dailyUsage = null
    if (startDate && endDate) {
      dailyUsage = await getUsageByDateRange(currentUser.id, startDate, endDate)
    }

    // Check quota (default: 100k tokens per month for free tier)
    const quota = await checkUsageQuota(currentUser.id, 100_000, 30)

    return NextResponse.json({
      stats,
      usage: usage.slice(0, 100), // Limit to 100 most recent records
      dailyUsage,
      quota,
      period: {
        startDate: startDate?.toISOString(),
        endDate: endDate?.toISOString(),
      },
    })
  } catch (error) {
    console.error("AI usage retrieval error:", error)
    return new NextResponse("Internal Error", { status: 500 })
  }
}
