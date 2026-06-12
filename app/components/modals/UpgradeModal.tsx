"use client"

import Link from "next/link"
import { HiCheck, HiOutlineSparkles } from "react-icons/hi2"

import { cn } from "@/app/lib/utils"
import { Button, buttonVariants } from "@/app/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/app/components/ui/dialog"

/**
 * AI access denial codes that this modal knows how to present.
 * Mirrors `AiAccessDecision["code"]` values from app/lib/ai-access.ts.
 */
export type UpgradeModalReason = "FREE_TIER_MESSAGE_LIMIT_REACHED" | "PRO_TIER_COST_CAP_REACHED"

// Copy mirrors `proPlan` in config/subscriptions.ts. We cannot import that
// module here: it reads server-only env (STRIPE_PRO_MONTHLY_PLAN_ID) at module
// init, which throws in client bundles. Keep these in sync with the config.
const PRO_PRICE_PER_MONTH = "$9.99/month"
const PRO_HIGHLIGHTS = [
  "High monthly limits (fair use cap applies)",
  "Claude Sonnet 4.5 + Haiku 4.5",
  "Priority support",
]

const SUPPORT_EMAIL = "support@infinistar.app"

interface UpgradeModalProps {
  isOpen: boolean
  onClose: () => void
  /** Which limit was hit; controls the headline, body, and CTA */
  reason?: UpgradeModalReason
  /** `limits` payload from the API error response (AiAccessDecision["limits"]) */
  limits?: unknown
}

/** Safely extract the monthly message limit from the untyped `limits` payload. */
function getMonthlyMessageLimit(limits: unknown): number | null {
  if (limits && typeof limits === "object" && "monthlyMessageLimit" in limits) {
    const value = (limits as { monthlyMessageLimit?: unknown }).monthlyMessageLimit
    if (typeof value === "number" && Number.isFinite(value) && value > 0) {
      return value
    }
  }
  return null
}

/**
 * Shown when a user hits an AI usage limit, replacing the dead-end error toast.
 *
 * - FREE_TIER_MESSAGE_LIMIT_REACHED: upsell to PRO with a link to /pricing
 * - PRO_TIER_COST_CAP_REACHED: fair-use cap notice with a contact-support CTA
 */
const UpgradeModal: React.FC<UpgradeModalProps> = ({
  isOpen,
  onClose,
  reason = "FREE_TIER_MESSAGE_LIMIT_REACHED",
  limits,
}) => {
  const isCostCap = reason === "PRO_TIER_COST_CAP_REACHED"
  const messageLimit = getMonthlyMessageLimit(limits)

  const title = isCostCap
    ? "You've reached this month's fair-use cap"
    : messageLimit !== null
      ? `You've used all ${messageLimit} free messages this month`
      : "You've used all your free messages this month"

  const description = isCostCap
    ? "PRO includes high monthly limits with a fair-use cap to keep things sustainable for everyone. Contact support and we'll help increase your limits."
    : "Your free messages reset at the start of next month. Upgrade to PRO to keep the conversation going without interruption."

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div
            className="mx-auto flex size-12 items-center justify-center rounded-full bg-muted sm:mx-0"
            aria-hidden="true"
          >
            <HiOutlineSparkles className="size-6 text-primary" />
          </div>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        {!isCostCap && (
          <ul className="space-y-2" aria-label="PRO plan benefits">
            {PRO_HIGHLIGHTS.map((feature) => (
              <li key={feature} className="flex items-start gap-3 text-sm">
                <HiCheck className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
                <span>{feature}</span>
              </li>
            ))}
          </ul>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="ghost" onClick={onClose}>
            Maybe later
          </Button>
          {isCostCap ? (
            <a
              href={`mailto:${SUPPORT_EMAIL}`}
              className={cn(buttonVariants())}
              aria-label={`Contact support at ${SUPPORT_EMAIL}`}
            >
              Contact Support
            </a>
          ) : (
            <Link
              href="/pricing"
              className={cn(buttonVariants({ variant: "gradient" }))}
              onClick={onClose}
            >
              Upgrade to PRO — {PRO_PRICE_PER_MONTH}
            </Link>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default UpgradeModal
