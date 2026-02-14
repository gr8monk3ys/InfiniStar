import { NextResponse, type NextRequest } from "next/server"

import { FREE_TIER_MONTHLY_MESSAGE_LIMIT, FREE_TIER_MONTHLY_TOKEN_QUOTA } from "@/app/lib/ai-access"
import { checkUsageQuota, getUsageByDateRange, getUserUsageStats } from "@/app/lib/ai-usage"
import prisma from "@/app/lib/prismadb"
import { getUserSubscriptionPlan } from "@/app/lib/subscription"
import getCurrentUser from "@/app/actions/getCurrentUser"

// Context window sizes for different Claude models
const MODEL_CONTEXT_WINDOWS: Record<string, number> = {
  "claude-3-5-sonnet-20241022": 200_000,
  "claude-3-opus-20240229": 200_000,
  "claude-3-5-haiku-20241022": 200_000,
  "claude-3-haiku-20240307": 200_000,
}

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
      default: {
        // Custom date range from query params
        const startParam = searchParams.get("startDate")
        const endParam = searchParams.get("endDate")
        if (startParam) startDate = new Date(startParam)
        if (endParam) endDate = new Date(endParam)
      }
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

    // Check quota for free-tier usage.
    const quota = await checkUsageQuota(currentUser.id, FREE_TIER_MONTHLY_TOKEN_QUOTA, 30)

    // Get user's subscription plan
    let subscriptionPlan = null
    try {
      subscriptionPlan = await getUserSubscriptionPlan(currentUser.id)
    } catch {
      // User might not have subscription data
    }

    // Calculate monthly message count for free tier limits
    const monthStart = new Date()
    monthStart.setDate(1)
    monthStart.setHours(0, 0, 0, 0)

    const monthlyMessageCount = await prisma.aiUsage.count({
      where: {
        userId: currentUser.id,
        createdAt: { gte: monthStart },
        requestType: { in: ["chat", "chat-stream"] },
      },
    })

    // Get conversation token usage if conversationId provided
    let conversationTokens = null
    if (conversationId) {
      const conversationUsage = await prisma.aiUsage.aggregate({
        where: {
          userId: currentUser.id,
          conversationId,
        },
        _sum: {
          inputTokens: true,
          outputTokens: true,
          totalTokens: true,
        },
      })

      // Get conversation model to determine context window
      const conversation = await prisma.conversation.findUnique({
        where: { id: conversationId },
        select: { aiModel: true },
      })

      const model = conversation?.aiModel || "claude-3-5-sonnet-20241022"
      const contextWindow = MODEL_CONTEXT_WINDOWS[model] || 200_000

      // Get the latest message input tokens to estimate current context usage
      const latestUsage = await prisma.aiUsage.findFirst({
        where: {
          userId: currentUser.id,
          conversationId,
        },
        orderBy: { createdAt: "desc" },
        select: { inputTokens: true },
      })

      conversationTokens = {
        totalInputTokens: conversationUsage._sum.inputTokens || 0,
        totalOutputTokens: conversationUsage._sum.outputTokens || 0,
        totalTokens: conversationUsage._sum.totalTokens || 0,
        currentContextTokens: latestUsage?.inputTokens || 0,
        contextWindowSize: contextWindow,
        contextUsagePercentage: latestUsage?.inputTokens
          ? Math.round((latestUsage.inputTokens / contextWindow) * 10000) / 100
          : 0,
      }
    }

    // Calculate remaining messages for free tier
    const isPro = subscriptionPlan?.isPro || false
    const remainingMessages = isPro
      ? null
      : Math.max(0, FREE_TIER_MONTHLY_MESSAGE_LIMIT - monthlyMessageCount)

    // Get model usage distribution
    const modelUsage = await getModelUsageDistribution(currentUser.id, startDate, endDate)

    // Get personality usage distribution
    const personalityUsage = await getPersonalityUsageDistribution(
      currentUser.id,
      startDate,
      endDate
    )

    // Get hourly usage heatmap data
    const hourlyUsage = await getHourlyUsagePattern(currentUser.id, startDate, endDate)

    // Get average messages per conversation
    const avgMessagesPerConversation = await getAverageMessagesPerConversation(
      currentUser.id,
      startDate,
      endDate
    )

    // Get peak usage hours
    const peakUsageHours = await getPeakUsageHours(currentUser.id, startDate, endDate)

    return NextResponse.json({
      stats,
      usage: usage.slice(0, 100), // Limit to 100 most recent records
      dailyUsage,
      quota,
      period: {
        startDate: startDate?.toISOString(),
        endDate: endDate?.toISOString(),
      },
      // New fields for token usage display
      subscription: {
        isPro,
        plan: subscriptionPlan?.name || "Free",
        monthlyMessageCount,
        monthlyMessageLimit: isPro ? null : FREE_TIER_MONTHLY_MESSAGE_LIMIT,
        remainingMessages,
      },
      conversationTokens,
      contextWindows: MODEL_CONTEXT_WINDOWS,
      // New analytics fields
      modelUsage,
      personalityUsage,
      hourlyUsage,
      avgMessagesPerConversation,
      peakUsageHours,
    })
  } catch (error) {
    console.error("AI usage retrieval error:", error)
    return new NextResponse("Internal Error", { status: 500 })
  }
}

/**
 * Get model usage distribution
 */
async function getModelUsageDistribution(
  userId: string,
  startDate?: Date,
  endDate?: Date
): Promise<{ model: string; count: number; tokens: number; cost: number }[]> {
  const where: {
    userId: string
    createdAt?: { gte?: Date; lte?: Date }
  } = { userId }

  if (startDate || endDate) {
    where.createdAt = {}
    if (startDate) where.createdAt.gte = startDate
    if (endDate) where.createdAt.lte = endDate
  }

  const usage = await prisma.aiUsage.findMany({
    where,
    select: {
      model: true,
      totalTokens: true,
      totalCost: true,
    },
  })

  // Group by model
  const modelMap = new Map<string, { count: number; tokens: number; cost: number }>()

  for (const record of usage) {
    const existing = modelMap.get(record.model) || { count: 0, tokens: 0, cost: 0 }
    modelMap.set(record.model, {
      count: existing.count + 1,
      tokens: existing.tokens + record.totalTokens,
      cost: existing.cost + record.totalCost,
    })
  }

  return Array.from(modelMap.entries())
    .map(([model, data]) => ({
      model: formatModelName(model),
      count: data.count,
      tokens: data.tokens,
      cost: Math.round(data.cost * 100) / 100,
    }))
    .sort((a, b) => b.count - a.count)
}

/**
 * Get personality usage distribution
 */
async function getPersonalityUsageDistribution(
  userId: string,
  startDate?: Date,
  endDate?: Date
): Promise<{ personality: string; count: number; tokens: number }[]> {
  const where: {
    userId: string
    createdAt?: { gte?: Date; lte?: Date }
  } = { userId }

  if (startDate || endDate) {
    where.createdAt = {}
    if (startDate) where.createdAt.gte = startDate
    if (endDate) where.createdAt.lte = endDate
  }

  const usage = await prisma.aiUsage.findMany({
    where,
    select: {
      conversationId: true,
      totalTokens: true,
    },
  })

  // Get unique conversation IDs
  const conversationIds = [
    ...new Set(usage.map((u: { conversationId: string }) => u.conversationId)),
  ]

  // Fetch personalities for these conversations
  const conversations = await prisma.conversation.findMany({
    where: {
      id: { in: conversationIds },
    },
    select: {
      id: true,
      aiPersonality: true,
    },
  })

  // Create a map of conversationId to personality
  const conversationPersonalityMap = new Map<string, string>()
  for (const conv of conversations) {
    conversationPersonalityMap.set(conv.id, conv.aiPersonality || "assistant")
  }

  // Group usage by personality
  const personalityMap = new Map<string, { count: number; tokens: number }>()

  for (const record of usage) {
    const personality = conversationPersonalityMap.get(record.conversationId) || "assistant"
    const existing = personalityMap.get(personality) || { count: 0, tokens: 0 }
    personalityMap.set(personality, {
      count: existing.count + 1,
      tokens: existing.tokens + record.totalTokens,
    })
  }

  return Array.from(personalityMap.entries())
    .map(([personality, data]) => ({
      personality: formatPersonalityName(personality),
      count: data.count,
      tokens: data.tokens,
    }))
    .sort((a, b) => b.count - a.count)
}

/**
 * Get hourly usage pattern for heatmap
 */
async function getHourlyUsagePattern(
  userId: string,
  startDate?: Date,
  endDate?: Date
): Promise<{ day: number; hour: number; count: number }[]> {
  const where: {
    userId: string
    createdAt?: { gte?: Date; lte?: Date }
  } = { userId }

  if (startDate || endDate) {
    where.createdAt = {}
    if (startDate) where.createdAt.gte = startDate
    if (endDate) where.createdAt.lte = endDate
  }

  const usage = await prisma.aiUsage.findMany({
    where,
    select: {
      createdAt: true,
    },
  })

  // Group by day of week (0-6) and hour (0-23)
  const heatmapData = new Map<string, number>()

  for (const record of usage) {
    const date = new Date(record.createdAt)
    const day = date.getDay() // 0 = Sunday, 6 = Saturday
    const hour = date.getHours()
    const key = `${day}-${hour}`
    heatmapData.set(key, (heatmapData.get(key) || 0) + 1)
  }

  // Convert to array format for the frontend
  const result: { day: number; hour: number; count: number }[] = []

  // Fill in all day/hour combinations
  for (let day = 0; day < 7; day++) {
    for (let hour = 0; hour < 24; hour++) {
      const key = `${day}-${hour}`
      result.push({
        day,
        hour,
        count: heatmapData.get(key) || 0,
      })
    }
  }

  return result
}

/**
 * Get average messages per conversation
 */
async function getAverageMessagesPerConversation(
  userId: string,
  startDate?: Date,
  endDate?: Date
): Promise<number> {
  const where: {
    userId: string
    createdAt?: { gte?: Date; lte?: Date }
  } = { userId }

  if (startDate || endDate) {
    where.createdAt = {}
    if (startDate) where.createdAt.gte = startDate
    if (endDate) where.createdAt.lte = endDate
  }

  const usage = await prisma.aiUsage.findMany({
    where,
    select: {
      conversationId: true,
    },
  })

  if (usage.length === 0) return 0

  const uniqueConversations = new Set(
    usage.map((u: { conversationId: string }) => u.conversationId)
  )
  return Math.round((usage.length / uniqueConversations.size) * 10) / 10
}

/**
 * Get peak usage hours
 */
async function getPeakUsageHours(
  userId: string,
  startDate?: Date,
  endDate?: Date
): Promise<{ hour: number; count: number }[]> {
  const where: {
    userId: string
    createdAt?: { gte?: Date; lte?: Date }
  } = { userId }

  if (startDate || endDate) {
    where.createdAt = {}
    if (startDate) where.createdAt.gte = startDate
    if (endDate) where.createdAt.lte = endDate
  }

  const usage = await prisma.aiUsage.findMany({
    where,
    select: {
      createdAt: true,
    },
  })

  // Group by hour
  const hourlyCount = new Map<number, number>()

  for (const record of usage) {
    const hour = new Date(record.createdAt).getHours()
    hourlyCount.set(hour, (hourlyCount.get(hour) || 0) + 1)
  }

  // Convert to array and sort by count
  return Array.from(hourlyCount.entries())
    .map(([hour, count]) => ({ hour, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5) // Top 5 peak hours
}

/**
 * Format model name for display
 */
function formatModelName(model: string): string {
  const modelNames: Record<string, string> = {
    "claude-3-5-sonnet-20241022": "Claude 3.5 Sonnet",
    "claude-3-opus-20240229": "Claude 3 Opus",
    "claude-3-5-haiku-20241022": "Claude 3.5 Haiku",
    "claude-3-haiku-20240307": "Claude 3 Haiku",
  }
  return modelNames[model] || model
}

/**
 * Format personality name for display
 */
function formatPersonalityName(personality: string): string {
  const personalityNames: Record<string, string> = {
    assistant: "Helpful Assistant",
    creative: "Creative Writer",
    technical: "Technical Expert",
    friendly: "Friendly Companion",
    professional: "Professional Consultant",
    socratic: "Socratic Tutor",
    concise: "Concise Advisor",
    custom: "Custom",
  }
  return personalityNames[personality] || personality
}
