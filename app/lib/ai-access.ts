import {
  AI_FREE_MONTHLY_MESSAGE_LIMIT,
  AI_FREE_MONTHLY_TOKEN_QUOTA,
  AI_PRO_MONTHLY_COST_CAP_CENTS,
} from "@/app/lib/ai-limits"
import prisma from "@/app/lib/prismadb"
import { getUserSubscriptionPlan } from "@/app/lib/subscription"

// Backwards-compatible exports (used across the app + API responses).
export const FREE_TIER_MONTHLY_MESSAGE_LIMIT = AI_FREE_MONTHLY_MESSAGE_LIMIT
export const FREE_TIER_MONTHLY_TOKEN_QUOTA = AI_FREE_MONTHLY_TOKEN_QUOTA

type AiAccessDenialCode =
  | "FREE_TIER_MESSAGE_LIMIT_REACHED"
  | "FREE_TIER_TOKEN_QUOTA_REACHED"
  | "PRO_TIER_COST_CAP_REACHED"
  | "AI_ACCESS_CHECK_FAILED"

export interface AiAccessDecision {
  allowed: boolean
  code?: AiAccessDenialCode
  message?: string
  limits?: {
    isPro: boolean
    monthlyMessageCount: number
    monthlyMessageLimit: number | null
    remainingMessages: number | null
    monthlyTokenUsage: number
    monthlyTokenQuota: number | null
    monthlyCostUsageCents: number
    monthlyCostQuotaCents: number | null
  }
}

function getMonthStartUtc(): Date {
  const now = new Date()
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0))
}

export async function getAiAccessDecision(userId: string): Promise<AiAccessDecision> {
  try {
    const subscriptionPlan = await getUserSubscriptionPlan(userId)
    const proCostCapCents = AI_PRO_MONTHLY_COST_CAP_CENTS

    const monthStart = getMonthStartUtc()
    const [monthlyMessageCount, monthlyAggregates] = await Promise.all([
      prisma.aiUsage.count({
        where: {
          userId,
          createdAt: { gte: monthStart },
          requestType: { in: ["chat", "chat-stream"] },
        },
      }),
      prisma.aiUsage.aggregate({
        where: {
          userId,
          createdAt: { gte: monthStart },
        },
        _sum: {
          totalTokens: true,
          totalCost: true,
        },
      }),
    ])

    const monthlyTokenUsage = monthlyAggregates._sum.totalTokens ?? 0
    const monthlyCostUsageCents = monthlyAggregates._sum.totalCost ?? 0

    if (subscriptionPlan.isPro) {
      if (proCostCapCents !== null && monthlyCostUsageCents >= proCostCapCents) {
        return {
          allowed: false,
          code: "PRO_TIER_COST_CAP_REACHED",
          message:
            "You have reached this month's AI fair-use cap. Please contact support to increase limits.",
          limits: {
            isPro: true,
            monthlyMessageCount,
            monthlyMessageLimit: null,
            remainingMessages: null,
            monthlyTokenUsage,
            monthlyTokenQuota: null,
            monthlyCostUsageCents,
            monthlyCostQuotaCents: proCostCapCents,
          },
        }
      }

      return {
        allowed: true,
        limits: {
          isPro: true,
          monthlyMessageCount,
          monthlyMessageLimit: null,
          remainingMessages: null,
          monthlyTokenUsage,
          monthlyTokenQuota: null,
          monthlyCostUsageCents,
          monthlyCostQuotaCents: proCostCapCents,
        },
      }
    }

    const remainingMessages = Math.max(0, FREE_TIER_MONTHLY_MESSAGE_LIMIT - monthlyMessageCount)

    if (monthlyMessageCount >= FREE_TIER_MONTHLY_MESSAGE_LIMIT) {
      return {
        allowed: false,
        code: "FREE_TIER_MESSAGE_LIMIT_REACHED",
        message:
          "You have reached the free-tier monthly AI message limit. Upgrade to PRO for higher limits.",
        limits: {
          isPro: false,
          monthlyMessageCount,
          monthlyMessageLimit: FREE_TIER_MONTHLY_MESSAGE_LIMIT,
          remainingMessages: 0,
          monthlyTokenUsage,
          monthlyTokenQuota: FREE_TIER_MONTHLY_TOKEN_QUOTA,
          monthlyCostUsageCents,
          monthlyCostQuotaCents: null,
        },
      }
    }

    if (monthlyTokenUsage >= FREE_TIER_MONTHLY_TOKEN_QUOTA) {
      return {
        allowed: false,
        code: "FREE_TIER_TOKEN_QUOTA_REACHED",
        message:
          "You have reached the free-tier monthly AI token quota. Upgrade to PRO for higher limits.",
        limits: {
          isPro: false,
          monthlyMessageCount,
          monthlyMessageLimit: FREE_TIER_MONTHLY_MESSAGE_LIMIT,
          remainingMessages,
          monthlyTokenUsage,
          monthlyTokenQuota: FREE_TIER_MONTHLY_TOKEN_QUOTA,
          monthlyCostUsageCents,
          monthlyCostQuotaCents: null,
        },
      }
    }

    return {
      allowed: true,
      limits: {
        isPro: false,
        monthlyMessageCount,
        monthlyMessageLimit: FREE_TIER_MONTHLY_MESSAGE_LIMIT,
        remainingMessages,
        monthlyTokenUsage,
        monthlyTokenQuota: FREE_TIER_MONTHLY_TOKEN_QUOTA,
        monthlyCostUsageCents,
        monthlyCostQuotaCents: null,
      },
    }
  } catch {
    return {
      allowed: false,
      code: "AI_ACCESS_CHECK_FAILED",
      message: "Unable to verify AI usage limits right now. Please try again.",
    }
  }
}
