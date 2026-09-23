import { NextResponse, type NextRequest } from "next/server"

import {
  FREE_TIER_MONTHLY_MESSAGE_LIMIT,
  FREE_TIER_MONTHLY_TOKEN_QUOTA,
  monthlySnapshot,
} from "@/app/lib/ai-access"
import { AI_PRO_MONTHLY_COST_CAP_CENTS } from "@/app/lib/ai-limits"
import { normalizeModelId } from "@/app/lib/ai-model-routing"
import { getUsageByDateRange, getUserUsageStats } from "@/app/lib/ai-usage"
import { aiLogger } from "@/app/lib/logger"
import prisma from "@/app/lib/prismadb"
import { apiLimiter } from "@/app/lib/rate-limit"
import { getUserSubscriptionPlan } from "@/app/lib/subscription"
import getCurrentUser from "@/app/actions/getCurrentUser"

// Context window sizes for different Claude models
const MODEL_CONTEXT_WINDOWS: Record<string, number> = {
  "claude-sonnet-4-6": 1_000_000,
  "claude-haiku-4-5": 200_000,
  // Legacy ids
  "claude-sonnet-4-5-20250929": 200_000,
  "claude-haiku-4-5-20251001": 200_000,
  "claude-opus-4-1-20250805": 200_000,
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

    // Keyed on the account rather than the client, because this runs after auth.
    // ADR-0003: an omitted limiter is not detectable while routes hand-roll the
    // preamble, and this route had none at all.
    if (!(await Promise.resolve(apiLimiter.check(currentUser.id)))) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429, headers: { "Retry-After": "60" } }
      )
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
        if (startParam) {
          startDate = new Date(startParam)
          if (isNaN(startDate.getTime())) {
            return NextResponse.json({ error: "Invalid startDate" }, { status: 400 })
          }
        }
        if (endParam) {
          endDate = new Date(endParam)
          if (isNaN(endDate.getTime())) {
            return NextResponse.json({ error: "Invalid endDate" }, { status: 400 })
          }
        }
      }
    }

    // Every read below depends only on the user and the date range, so they run
    // together rather than as a ten-query waterfall.
    const [
      { usage, stats },
      dailyUsage,
      subscriptionPlan,
      { monthlyMessageCount, monthlyTokenUsage, monthlyCostUsageCents },
      conversationTokens,
      modelUsage,
      personalityUsage,
      hourlyUsage,
      avgMessagesPerConversation,
      peakUsageHours,
    ] = await Promise.all([
      getUserUsageStats(currentUser.id, {
        startDate,
        endDate,
        conversationId,
      }),
      // Daily breakdown only when there is a bounded range
      startDate && endDate
        ? getUsageByDateRange(currentUser.id, startDate, endDate)
        : Promise.resolve(null),
      // User might not have subscription data
      getUserSubscriptionPlan(currentUser.id).catch(() => null),
      // The month is counted in one place, shared with the check that actually
      // gates the chatter. This route used to run its own copy of these
      // aggregates with its own copy of `getMonthStartUtc`, and the two had
      // already drifted: the enforced aggregate excludes `summary-auto` rows and
      // this one did not, so the dashboard showed a number strictly larger than
      // the one gating them — and `auto-summary.ts` writes a `summary-auto` row
      // per conversation, so the gap grew with use.
      monthlySnapshot(currentUser.id),
      conversationId
        ? getConversationTokens(currentUser.id, conversationId)
        : Promise.resolve(null),
      getModelUsageDistribution(currentUser.id, startDate, endDate),
      getPersonalityUsageDistribution(currentUser.id, startDate, endDate),
      getHourlyUsagePattern(currentUser.id, startDate, endDate),
      getAverageMessagesPerConversation(currentUser.id, startDate, endDate),
      getPeakUsageHours(currentUser.id, startDate, endDate),
    ])

    // Calculate remaining messages for free tier
    const isPro = subscriptionPlan?.isPro || false
    const remainingMessages = isPro
      ? null
      : Math.max(0, FREE_TIER_MONTHLY_MESSAGE_LIMIT - monthlyMessageCount)

    const monthlyTokenQuota = isPro ? null : FREE_TIER_MONTHLY_TOKEN_QUOTA
    const monthlyCostQuotaCents = isPro ? AI_PRO_MONTHLY_COST_CAP_CENTS : null

    return NextResponse.json({
      stats,
      usage: usage.slice(0, 100), // Limit to 100 most recent records
      dailyUsage,
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
        monthlyTokenUsage,
        monthlyTokenQuota,
        monthlyCostUsageCents,
        monthlyCostQuotaCents,
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
    aiLogger.error({ err: error }, "AI usage retrieval error")
    return new NextResponse("Internal Error", { status: 500 })
  }
}

/**
 * Token totals and context-window usage for one conversation. The three reads
 * are independent of each other, so they run together.
 */
async function getConversationTokens(userId: string, conversationId: string) {
  const [conversationUsage, conversation, latestUsage] = await Promise.all([
    prisma.aiUsage.aggregate({
      where: {
        userId,
        conversationId,
      },
      _sum: {
        inputTokens: true,
        outputTokens: true,
        totalTokens: true,
      },
    }),
    // Get conversation model to determine context window
    prisma.conversation.findUnique({
      where: { id: conversationId },
      select: { aiModel: true },
    }),
    // Get the latest message input tokens to estimate current context usage
    prisma.aiUsage.findFirst({
      where: {
        userId,
        conversationId,
      },
      orderBy: { createdAt: "desc" },
      select: { inputTokens: true },
    }),
  ])

  const model = normalizeModelId(conversation?.aiModel)
  const contextWindow = MODEL_CONTEXT_WINDOWS[model] || 200_000

  return {
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

const MODEL_DISPLAY_NAMES: Record<string, string> = {
  "claude-sonnet-4-6": "Claude Sonnet 4.6",
  "claude-haiku-4-5": "Claude Haiku 4.5",
  // Legacy ids
  "claude-sonnet-4-5-20250929": "Claude Sonnet 4.5",
  "claude-haiku-4-5-20251001": "Claude Haiku 4.5",
  "claude-opus-4-1-20250805": "Claude Opus 4.1",
  "claude-3-5-sonnet-20241022": "Claude 3.5 Sonnet",
  "claude-3-opus-20240229": "Claude 3 Opus",
  "claude-3-5-haiku-20241022": "Claude 3.5 Haiku",
  "claude-3-haiku-20240307": "Claude 3 Haiku",
}

const PERSONALITY_DISPLAY_NAMES: Record<string, string> = {
  assistant: "Helpful Assistant",
  creative: "Creative Writer",
  technical: "Technical Expert",
  friendly: "Friendly Companion",
  professional: "Professional Consultant",
  socratic: "Socratic Tutor",
  concise: "Concise Advisor",
  custom: "Custom",
}

/**
 * Format model name for display
 */
function formatModelName(model: string): string {
  return MODEL_DISPLAY_NAMES[model] || model
}

/**
 * Format personality name for display
 */
function formatPersonalityName(personality: string): string {
  return PERSONALITY_DISPLAY_NAMES[personality] || personality
}
