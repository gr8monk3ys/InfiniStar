import prisma from "@/app/lib/prismadb"
import { getUserSubscriptionPlan } from "@/app/lib/subscription"

export const FREE_TIER_MONTHLY_MESSAGE_LIMIT = 10
export const FREE_TIER_MONTHLY_TOKEN_QUOTA = 100_000

type AiAccessDenialCode =
  | "FREE_TIER_MESSAGE_LIMIT_REACHED"
  | "FREE_TIER_TOKEN_QUOTA_REACHED"
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
  }
}

function getMonthStartUtc(): Date {
  const now = new Date()
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0))
}

export async function getAiAccessDecision(userId: string): Promise<AiAccessDecision> {
  try {
    const subscriptionPlan = await getUserSubscriptionPlan(userId)
    if (subscriptionPlan.isPro) {
      return {
        allowed: true,
        limits: {
          isPro: true,
          monthlyMessageCount: 0,
          monthlyMessageLimit: null,
          remainingMessages: null,
          monthlyTokenUsage: 0,
          monthlyTokenQuota: null,
        },
      }
    }

    const monthStart = getMonthStartUtc()
    const [monthlyMessageCount, monthlyTokenAggregate] = await Promise.all([
      prisma.aiUsage.count({
        where: {
          userId,
          createdAt: { gte: monthStart },
        },
      }),
      prisma.aiUsage.aggregate({
        where: {
          userId,
          createdAt: { gte: monthStart },
        },
        _sum: {
          totalTokens: true,
        },
      }),
    ])

    const monthlyTokenUsage = monthlyTokenAggregate._sum.totalTokens ?? 0
    const remainingMessages = Math.max(0, FREE_TIER_MONTHLY_MESSAGE_LIMIT - monthlyMessageCount)

    if (monthlyMessageCount >= FREE_TIER_MONTHLY_MESSAGE_LIMIT) {
      return {
        allowed: false,
        code: "FREE_TIER_MESSAGE_LIMIT_REACHED",
        message:
          "You have reached the free-tier monthly AI message limit. Upgrade to PRO for unlimited usage.",
        limits: {
          isPro: false,
          monthlyMessageCount,
          monthlyMessageLimit: FREE_TIER_MONTHLY_MESSAGE_LIMIT,
          remainingMessages: 0,
          monthlyTokenUsage,
          monthlyTokenQuota: FREE_TIER_MONTHLY_TOKEN_QUOTA,
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
