/**
 * AI Usage Tracking Utilities
 *
 * This module provides utilities for tracking AI API usage,
 * calculating costs, and storing usage metrics.
 */

import prisma from "@/app/lib/prismadb"

/**
 * Pricing information for Anthropic Claude models (per million tokens)
 * Prices as of January 2025
 */
export const MODEL_PRICING = {
  "claude-3-5-sonnet-20241022": {
    input: 3.0, // $3 per million input tokens
    output: 15.0, // $15 per million output tokens
  },
  "claude-3-opus-20240229": {
    input: 15.0, // $15 per million input tokens
    output: 75.0, // $75 per million output tokens
  },
  "claude-3-haiku-20240307": {
    input: 0.25, // $0.25 per million input tokens
    output: 1.25, // $1.25 per million output tokens
  },
} as const

/**
 * Calculate cost in cents for token usage
 */
export function calculateTokenCost(
  model: string,
  inputTokens: number,
  outputTokens: number
): {
  inputCost: number
  outputCost: number
  totalCost: number
} {
  // Get pricing for model, default to Sonnet if unknown
  const pricing =
    MODEL_PRICING[model as keyof typeof MODEL_PRICING] ||
    MODEL_PRICING["claude-3-5-sonnet-20241022"]

  // Calculate costs in cents (divide by million for per-token rate, multiply by 100 for cents)
  const inputCost = (inputTokens / 1_000_000) * pricing.input * 100
  const outputCost = (outputTokens / 1_000_000) * pricing.output * 100
  const totalCost = inputCost + outputCost

  return {
    inputCost: Math.round(inputCost * 100) / 100, // Round to 2 decimal places
    outputCost: Math.round(outputCost * 100) / 100,
    totalCost: Math.round(totalCost * 100) / 100,
  }
}

/**
 * Track AI usage in the database
 */
export async function trackAiUsage({
  userId,
  conversationId,
  model,
  inputTokens,
  outputTokens,
  requestType,
  latencyMs,
}: {
  userId: string
  conversationId: string
  model: string
  inputTokens: number
  outputTokens: number
  requestType: "chat" | "chat-stream"
  latencyMs?: number
}) {
  const totalTokens = inputTokens + outputTokens
  const costs = calculateTokenCost(model, inputTokens, outputTokens)

  try {
    const usage = await prisma.aiUsage.create({
      data: {
        userId,
        conversationId,
        model,
        inputTokens,
        outputTokens,
        totalTokens,
        inputCost: costs.inputCost,
        outputCost: costs.outputCost,
        totalCost: costs.totalCost,
        requestType,
        latencyMs,
      },
    })

    return usage
  } catch (error) {
    console.error("Failed to track AI usage:", error)
    // Don't throw - usage tracking failure shouldn't break the API
    return null
  }
}

/**
 * Get usage statistics for a user
 */
export async function getUserUsageStats(
  userId: string,
  options?: {
    startDate?: Date
    endDate?: Date
    conversationId?: string
  }
) {
  const where: any = { userId }

  if (options?.conversationId) {
    where.conversationId = options.conversationId
  }

  if (options?.startDate || options?.endDate) {
    where.createdAt = {}
    if (options.startDate) {
      where.createdAt.gte = options.startDate
    }
    if (options.endDate) {
      where.createdAt.lte = options.endDate
    }
  }

  const usage = await prisma.aiUsage.findMany({
    where,
    orderBy: { createdAt: "desc" },
  })

  // Calculate aggregated stats
  const stats = usage.reduce(
    (acc, record) => ({
      totalRequests: acc.totalRequests + 1,
      totalInputTokens: acc.totalInputTokens + record.inputTokens,
      totalOutputTokens: acc.totalOutputTokens + record.outputTokens,
      totalTokens: acc.totalTokens + record.totalTokens,
      totalCost: acc.totalCost + record.totalCost,
      totalInputCost: acc.totalInputCost + record.inputCost,
      totalOutputCost: acc.totalOutputCost + record.outputCost,
      averageLatency: record.latencyMs
        ? (acc.averageLatency * acc.totalRequests + record.latencyMs) / (acc.totalRequests + 1)
        : acc.averageLatency,
    }),
    {
      totalRequests: 0,
      totalInputTokens: 0,
      totalOutputTokens: 0,
      totalTokens: 0,
      totalCost: 0,
      totalInputCost: 0,
      totalOutputCost: 0,
      averageLatency: 0,
    }
  )

  return {
    usage,
    stats: {
      ...stats,
      totalCost: Math.round(stats.totalCost * 100) / 100,
      totalInputCost: Math.round(stats.totalInputCost * 100) / 100,
      totalOutputCost: Math.round(stats.totalOutputCost * 100) / 100,
      averageLatency: Math.round(stats.averageLatency),
    },
  }
}

/**
 * Get usage statistics by date range (for charts/analytics)
 */
export async function getUsageByDateRange(userId: string, startDate: Date, endDate: Date) {
  const usage = await prisma.aiUsage.findMany({
    where: {
      userId,
      createdAt: {
        gte: startDate,
        lte: endDate,
      },
    },
    orderBy: { createdAt: "asc" },
  })

  // Group by date
  const byDate = usage.reduce((acc, record) => {
    const date = record.createdAt.toISOString().split("T")[0]
    if (!acc[date]) {
      acc[date] = {
        date,
        requests: 0,
        tokens: 0,
        cost: 0,
      }
    }
    acc[date].requests += 1
    acc[date].tokens += record.totalTokens
    acc[date].cost += record.totalCost
    return acc
  }, {} as Record<string, { date: string; requests: number; tokens: number; cost: number }>)

  return Object.values(byDate).map((day) => ({
    ...day,
    cost: Math.round(day.cost * 100) / 100,
  }))
}

/**
 * Check if user has exceeded usage quota (for free tier limits)
 */
export async function checkUsageQuota(
  userId: string,
  quotaTokens: number,
  periodDays: number = 30
): Promise<{
  withinQuota: boolean
  used: number
  remaining: number
  percentage: number
}> {
  const startDate = new Date()
  startDate.setDate(startDate.getDate() - periodDays)

  const { stats } = await getUserUsageStats(userId, { startDate })

  const used = stats.totalTokens
  const remaining = Math.max(0, quotaTokens - used)
  const percentage = Math.min(100, (used / quotaTokens) * 100)

  return {
    withinQuota: used < quotaTokens,
    used,
    remaining,
    percentage: Math.round(percentage * 100) / 100,
  }
}
