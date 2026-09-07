import { NextResponse } from "next/server"

import {
  AI_FREE_MONTHLY_IMAGE_LIMIT,
  AI_FREE_MONTHLY_MESSAGE_LIMIT,
  AI_FREE_MONTHLY_TOKEN_QUOTA,
  AI_FREE_MONTHLY_TRANSCRIBE_LIMIT,
  AI_PRO_MONTHLY_COST_CAP_CENTS,
  AI_PRO_MONTHLY_IMAGE_LIMIT,
  AI_PRO_MONTHLY_TRANSCRIBE_LIMIT,
} from "@/app/lib/ai-limits"
import { captureServerEvent } from "@/app/lib/analytics"
import prisma from "@/app/lib/prismadb"
import { getUserSubscriptionPlan } from "@/app/lib/subscription"

// Backwards-compatible exports (used across the app + API responses).
export const FREE_TIER_MONTHLY_MESSAGE_LIMIT = AI_FREE_MONTHLY_MESSAGE_LIMIT
export const FREE_TIER_MONTHLY_TOKEN_QUOTA = AI_FREE_MONTHLY_TOKEN_QUOTA

type AiAccessDenialCode =
  | "FREE_TIER_MESSAGE_LIMIT_REACHED"
  | "FREE_TIER_IMAGE_LIMIT_REACHED"
  | "FREE_TIER_TOKEN_QUOTA_REACHED"
  | "FREE_TIER_TRANSCRIBE_LIMIT_REACHED"
  | "PRO_TIER_COST_CAP_REACHED"
  | "PRO_TIER_IMAGE_LIMIT_REACHED"
  | "PRO_TIER_TRANSCRIBE_LIMIT_REACHED"
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

export function getMonthStartUtc(): Date {
  const now = new Date()
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0))
}

/**
 * What a chatter has used this calendar month.
 *
 * This is the one place the month is counted. `/api/ai/usage` used to run its
 * own copy of these aggregates, with its own copy of `getMonthStartUtc` — and
 * the two had already drifted: the enforced aggregate excludes `summary-auto`
 * rows and the displayed one did not, so the dashboard showed a chatter a
 * larger number than the one actually gating them. `auto-summary.ts` writes a
 * `summary-auto` row per conversation, so the gap grows with use.
 */
export interface MonthlySnapshot {
  monthStart: Date
  monthlyMessageCount: number
  monthlyTokenUsage: number
  monthlyCostUsageCents: number
}

/**
 * Request types that count as a chatter's own AI messages.
 *
 * Load-bearing for billing rather than descriptive — see ADR-0002. A
 * Regeneration is logged as `chat` so that it stays inside this pair.
 */
export const COUNTED_MESSAGE_REQUEST_TYPES = ["chat", "chat-stream"] as const

/**
 * Request types excluded from a chatter's usage totals.
 *
 * Background, system-initiated generation (automatic conversation summaries)
 * must never count against a quota or cost cap — the chatter did not ask for
 * it. It is still tracked as an AiUsage row for analytics.
 */
export const UNCOUNTED_REQUEST_TYPES = ["summary-auto"] as const

export async function monthlySnapshot(userId: string): Promise<MonthlySnapshot> {
  const monthStart = getMonthStartUtc()

  const [monthlyMessageCount, aggregates] = await Promise.all([
    prisma.aiUsage.count({
      where: {
        userId,
        createdAt: { gte: monthStart },
        requestType: { in: [...COUNTED_MESSAGE_REQUEST_TYPES] },
      },
    }),
    prisma.aiUsage.aggregate({
      where: {
        userId,
        createdAt: { gte: monthStart },
        requestType: { notIn: [...UNCOUNTED_REQUEST_TYPES] },
      },
      _sum: { totalTokens: true, totalCost: true },
    }),
  ])

  return {
    monthStart,
    monthlyMessageCount,
    monthlyTokenUsage: aggregates._sum.totalTokens ?? 0,
    monthlyCostUsageCents: aggregates._sum.totalCost ?? 0,
  }
}

export type AiAccessRequestType =
  | "chat"
  | "chat-stream"
  | "suggestions"
  | "memory-extract"
  | "summary"
  | "image-generate"
  | "transcribe"

export async function getAiAccessDecision(
  userId: string,
  options?: { requestType?: AiAccessRequestType }
): Promise<AiAccessDecision> {
  try {
    const subscriptionPlan = await getUserSubscriptionPlan(userId)
    const proCostCapCents = AI_PRO_MONTHLY_COST_CAP_CENTS
    const requestType = options?.requestType ?? "chat"

    const denyWithEvent = (decision: AiAccessDecision): AiAccessDecision => {
      captureServerEvent(userId, "ai_limit_reached", {
        code: decision.code,
        requestType,
        isPro: decision.limits?.isPro ?? null,
      })
      return decision
    }

    const featureLimit =
      requestType === "image-generate"
        ? subscriptionPlan.isPro
          ? AI_PRO_MONTHLY_IMAGE_LIMIT
          : AI_FREE_MONTHLY_IMAGE_LIMIT
        : requestType === "transcribe"
          ? subscriptionPlan.isPro
            ? AI_PRO_MONTHLY_TRANSCRIBE_LIMIT
            : AI_FREE_MONTHLY_TRANSCRIBE_LIMIT
          : null

    const shouldCountFeatureRequests =
      (requestType === "image-generate" || requestType === "transcribe") &&
      featureLimit !== null &&
      featureLimit > 0

    // One read point for the month, shared with /api/ai/usage so the displayed
    // Allowance and the enforced Allowance cannot drift apart again.
    const snapshot = await monthlySnapshot(userId)
    const { monthStart, monthlyMessageCount, monthlyTokenUsage, monthlyCostUsageCents } = snapshot

    const monthlyFeatureCount = shouldCountFeatureRequests
      ? await prisma.aiUsage.count({
          where: {
            userId,
            createdAt: { gte: monthStart },
            requestType,
          },
        })
      : 0

    if (subscriptionPlan.isPro) {
      if (proCostCapCents !== null && monthlyCostUsageCents >= proCostCapCents) {
        return denyWithEvent({
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
        })
      }

      if (requestType === "image-generate" && AI_PRO_MONTHLY_IMAGE_LIMIT !== null) {
        if (monthlyFeatureCount >= AI_PRO_MONTHLY_IMAGE_LIMIT) {
          return denyWithEvent({
            allowed: false,
            code: "PRO_TIER_IMAGE_LIMIT_REACHED",
            message:
              AI_PRO_MONTHLY_IMAGE_LIMIT === 0
                ? "Image generation is disabled for this account right now."
                : "You have reached this month's image generation limit. Please contact support to increase limits.",
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
          })
        }
      }

      if (requestType === "transcribe" && AI_PRO_MONTHLY_TRANSCRIBE_LIMIT !== null) {
        if (monthlyFeatureCount >= AI_PRO_MONTHLY_TRANSCRIBE_LIMIT) {
          return denyWithEvent({
            allowed: false,
            code: "PRO_TIER_TRANSCRIBE_LIMIT_REACHED",
            message:
              AI_PRO_MONTHLY_TRANSCRIBE_LIMIT === 0
                ? "Transcription is disabled for this account right now."
                : "You have reached this month's transcription limit. Please contact support to increase limits.",
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
          })
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
      return denyWithEvent({
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
      })
    }

    if (monthlyTokenUsage >= FREE_TIER_MONTHLY_TOKEN_QUOTA) {
      return denyWithEvent({
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
      })
    }

    if (requestType === "image-generate") {
      if (AI_FREE_MONTHLY_IMAGE_LIMIT === 0 || monthlyFeatureCount >= AI_FREE_MONTHLY_IMAGE_LIMIT) {
        return denyWithEvent({
          allowed: false,
          code: "FREE_TIER_IMAGE_LIMIT_REACHED",
          message:
            AI_FREE_MONTHLY_IMAGE_LIMIT === 0
              ? "Image generation is available on PRO. Upgrade to PRO to generate images."
              : "You have reached the free-tier monthly image generation limit. Upgrade to PRO for higher limits.",
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
        })
      }
    }

    if (requestType === "transcribe") {
      if (
        AI_FREE_MONTHLY_TRANSCRIBE_LIMIT === 0 ||
        monthlyFeatureCount >= AI_FREE_MONTHLY_TRANSCRIBE_LIMIT
      ) {
        return denyWithEvent({
          allowed: false,
          code: "FREE_TIER_TRANSCRIBE_LIMIT_REACHED",
          message:
            AI_FREE_MONTHLY_TRANSCRIBE_LIMIT === 0
              ? "Voice transcription is available on PRO. Upgrade to PRO to transcribe voice messages."
              : "You have reached the free-tier monthly transcription limit. Upgrade to PRO for higher limits.",
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
        })
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
    captureServerEvent(userId, "ai_limit_reached", {
      code: "AI_ACCESS_CHECK_FAILED",
      requestType: options?.requestType ?? "chat",
      isPro: null,
    })
    return {
      allowed: false,
      code: "AI_ACCESS_CHECK_FAILED",
      message: "Unable to verify AI usage limits right now. Please try again.",
    }
  }
}

/**
 * The Allowance decision, finished.
 *
 * `getAiAccessDecision` returned a decision it did not enforce, and callers
 * finished it themselves. Three things were being re-derived at ten call sites:
 *
 *  - **The 402.** Eight routes spelled the same denial response — same message
 *    fallback, same body shape, same status.
 *  - **The PRO cost cap with a pre-charge estimate.** `image/generate` and
 *    `transcribe` pulled `monthlyCostQuotaCents` and `monthlyCostUsageCents`
 *    back out of `limits` and re-ran a check the module already knows how to do.
 *  - **The Tier.** Model routing read `limits?.isPro ?? false`. `limits` is
 *    typed optional, so the day an `allowed: true` path returns without it,
 *    every PRO chatter silently drops to the free-tier model with no error
 *    anywhere — and `ai-image-generate-route.test.ts` already returns exactly
 *    that shape. Tier is a first-class field on the grant instead of a value
 *    read back out of a usage-display bag.
 *
 * Callers now read: `if (!grant.ok) return grant.response`.
 */
export type AiAccessGrant =
  | {
      ok: true
      /** The Tier this request is served at. */
      isPro: boolean
      limits: NonNullable<AiAccessDecision["limits"]>
    }
  | { ok: false; response: NextResponse }

export interface RequestAiAccessArgs {
  userId: string
  requestType?: AiAccessRequestType
  /**
   * What this request is about to cost, in cents, for request types that can
   * estimate it up front. The PRO cost cap is applied to usage *plus* this, so
   * a single expensive request cannot step over the cap.
   */
  estimatedCostCents?: number
}

function accessDenied(decision: AiAccessDecision): NextResponse {
  return NextResponse.json(
    {
      error:
        decision.message ??
        "AI access is unavailable for this account right now. Please try again.",
      code: decision.code,
      limits: decision.limits,
    },
    { status: 402 }
  )
}

export async function requestAiAccess({
  userId,
  requestType,
  estimatedCostCents = 0,
}: RequestAiAccessArgs): Promise<AiAccessGrant> {
  const decision = await getAiAccessDecision(userId, { requestType })

  // Every `allowed: true` path returns limits; the failure path returns
  // `allowed: false` with none. A grant with neither is a bug, and denying is
  // the fail-safe answer — the alternative is serving a PRO chatter the
  // free-tier model and charging them for PRO.
  if (!decision.allowed || !decision.limits) {
    return { ok: false, response: accessDenied(decision) }
  }

  const { isPro, monthlyCostQuotaCents, monthlyCostUsageCents } = decision.limits

  if (isPro && monthlyCostQuotaCents !== null && estimatedCostCents > 0) {
    if (monthlyCostUsageCents + estimatedCostCents > monthlyCostQuotaCents) {
      return {
        ok: false,
        response: accessDenied({
          allowed: false,
          code: "PRO_TIER_COST_CAP_REACHED",
          message:
            "You have reached this month's AI fair-use cap. Please contact support to increase limits.",
          limits: decision.limits,
        }),
      }
    }
  }

  return { ok: true, isPro, limits: decision.limits }
}
