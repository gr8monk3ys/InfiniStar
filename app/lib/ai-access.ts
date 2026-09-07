import { NextResponse } from "next/server"
import { Prisma } from "@prisma/client"

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
import { aiLogger as aiAccessLogger } from "@/app/lib/logger"
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

/**
 * The model recorded on a Claim that has not been filled in yet. A row still
 * carrying it was claimed by a turn that never reported a result.
 */
export const PENDING_CLAIM_MODEL = "pending"

export async function monthlySnapshot(
  userId: string,
  client: Prisma.TransactionClient = prisma
): Promise<MonthlySnapshot> {
  const monthStart = getMonthStartUtc()

  const [monthlyMessageCount, aggregates] = await Promise.all([
    client.aiUsage.count({
      where: {
        userId,
        createdAt: { gte: monthStart },
        requestType: { in: [...COUNTED_MESSAGE_REQUEST_TYPES] },
      },
    }),
    client.aiUsage.aggregate({
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
  options?: { requestType?: AiAccessRequestType; client?: Prisma.TransactionClient }
): Promise<AiAccessDecision> {
  const client = options?.client ?? prisma
  try {
    const subscriptionPlan = await getUserSubscriptionPlan(userId, client)
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
    const snapshot = await monthlySnapshot(userId, client)
    const { monthStart, monthlyMessageCount, monthlyTokenUsage, monthlyCostUsageCents } = snapshot

    const monthlyFeatureCount = shouldCountFeatureRequests
      ? await client.aiUsage.count({
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
  /** Read on this client, so a caller inside a transaction stays on one connection. */
  client?: Prisma.TransactionClient
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
  client,
}: RequestAiAccessArgs): Promise<AiAccessGrant> {
  const decision = await getAiAccessDecision(userId, { requestType, client })

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

/**
 * A reserved slot in the chatter's Allowance.
 *
 * The id is an `AiUsage` row that already exists with zero tokens. It counts
 * toward the month from the moment it is written, which is what makes a
 * concurrent turn see it.
 */
export interface AllowanceClaim {
  id: string
}

/**
 * How many times to try for the lock before giving up, and how long to wait
 * between attempts.
 *
 * Five attempts at 40ms is at most ~200ms of waiting. A single account with
 * more than five genuinely simultaneous turns is already pathological — the UI
 * sends one at a time — so exhausting these means something is wrong, and
 * answering "try again" is better than queueing indefinitely.
 */
const CLAIM_LOCK_ATTEMPTS = 5
const CLAIM_LOCK_BACKOFF_MS = 40

/**
 * How long a claim transaction may run. Prisma's default is 5s, which is
 * generous for two indexed reads and an insert; naming it keeps a slow claim
 * from silently becoming a request that hangs.
 */
const CLAIM_TRANSACTION_TIMEOUT_MS = 5_000

/**
 * Tries for the chatter's Allowance lock without waiting on it.
 *
 * `pg_advisory_xact_lock` would block, and a transaction blocked on a lock
 * still occupies its pool connection. `pg` defaults to ten connections and this
 * app does not configure it, so a queue of turns from one account would tie up
 * connections that unrelated queries need. The non-blocking form returns
 * immediately, the transaction ends, the connection goes back, and the caller
 * waits outside the pool before trying again.
 */
async function tryLockAllowance(tx: Prisma.TransactionClient, userId: string): Promise<boolean> {
  const rows = await tx.$queryRaw<
    { locked: boolean }[]
  >`SELECT pg_try_advisory_xact_lock(hashtext(${userId})) AS locked`

  return rows[0]?.locked === true
}

/**
 * Takes a Claim on the Allowance before the provider is called.
 *
 * `getAiAccessDecision` counts and `trackAiUsage` writes, and nothing reserved
 * anything in between — so two turns at 49 of 50 both counted 49 and both
 * proceeded. `aiChatLimiter` allows 20/min, which is the size of the overshoot.
 *
 * ADR-0001 already has the word for the fix: a Claim, "written before any side
 * effect runs so that a retry cannot double-process it". The same shape works
 * here, with one difference — a webhook claim is keyed on the provider's event
 * id, and there is no id to key an Allowance on, so the serialisation comes
 * from an advisory lock rather than a unique constraint.
 *
 * The Claim is the `AiUsage` row itself, written with zero tokens and filled in
 * when the reply lands. Deliberately not a second table: the displayed and
 * enforced Allowance drifted apart once already because the month was counted
 * in two places, and a separate reservations table would be a third.
 */
export async function claimAllowanceSlot({
  userId,
  // Defaulted to match `getAiAccessDecision`, so the Claim is recorded under
  // the same label the decision was made under.
  requestType = "chat",
  conversationId,
  estimatedCostCents = 0,
}: RequestAiAccessArgs & { conversationId: string }): Promise<
  AiAccessGrant & { claim?: AllowanceClaim }
> {
  try {
    for (let attempt = 0; attempt < CLAIM_LOCK_ATTEMPTS; attempt++) {
      const result = await prisma.$transaction(
        async (tx) => {
          // Not held while waiting: a failed attempt ends the transaction and
          // gives the connection back before we sleep.
          if (!(await tryLockAllowance(tx, userId))) {
            return null
          }

          // Read on `tx`, not the global client. Reading on the pool would hold
          // a second connection for the life of this transaction, and `pg`
          // defaults to a pool of ten — roughly six concurrent turns would then
          // deadlock, every transaction waiting for a connection none of them
          // will release.
          const grant = await requestAiAccess({
            userId,
            requestType,
            estimatedCostCents,
            client: tx,
          })
          if (!grant.ok) {
            return grant
          }

          const claim = await tx.aiUsage.create({
            data: {
              userId,
              conversationId,
              // Filled in by `trackAiUsage` when the reply lands. A row still
              // carrying this was claimed by a turn that never finished.
              model: PENDING_CLAIM_MODEL,
              inputTokens: 0,
              outputTokens: 0,
              totalTokens: 0,
              inputCost: 0,
              outputCost: 0,
              totalCost: 0,
              requestType,
            },
            select: { id: true },
          })

          return { ...grant, claim }
        },
        { timeout: CLAIM_TRANSACTION_TIMEOUT_MS }
      )

      if (result) {
        return result
      }

      await new Promise((resolve) => setTimeout(resolve, CLAIM_LOCK_BACKOFF_MS))
    }

    // Never proceed unclaimed: not getting the lock means not knowing whether
    // there is Allowance left, and the fail-safe answer to that is to deny.
    aiAccessLogger.warn({ userId, requestType }, "ALLOWANCE_CLAIM_LOCK_CONTENDED")
    return {
      ok: false,
      response: accessDenied({
        allowed: false,
        code: "AI_ACCESS_CHECK_FAILED",
        message: "Too many messages in flight for this account. Please try again.",
      }),
    }
  } catch (error) {
    // A failure to take the Claim is a failure to verify the Allowance, and the
    // fail-safe answer to that is the same as any other: deny.
    aiAccessLogger.error({ err: error, userId, requestType }, "ALLOWANCE_CLAIM_FAILED")
    return {
      ok: false,
      response: accessDenied({
        allowed: false,
        code: "AI_ACCESS_CHECK_FAILED",
        message: "Unable to verify AI usage limits right now. Please try again.",
      }),
    }
  }
}

/**
 * Gives back a Claim whose turn never produced anything.
 *
 * Best-effort: a Claim that outlives its turn costs the chatter one message of
 * their monthly Allowance, which is the safe direction to fail in. Leaving it
 * is much better than releasing one that did produce a reply.
 */
export async function releaseAllowanceClaim(claim: AllowanceClaim): Promise<void> {
  try {
    await prisma.aiUsage.delete({ where: { id: claim.id } })
  } catch (error) {
    aiAccessLogger.warn({ err: error, claimId: claim.id }, "ALLOWANCE_CLAIM_RELEASE_FAILED")
  }
}
