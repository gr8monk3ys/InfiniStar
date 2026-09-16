"use client"

import Link from "next/link"

import { cn } from "@/app/lib/utils"
import { buttonVariants } from "@/app/components/ui/button"
import { useAppAuth } from "@/app/hooks/useAppAuth"

import { PricingCtaButton } from "./PricingCtaButton"

/**
 * The two plan buttons, resolved on the client.
 *
 * The pricing page is prerendered, so its HTML is the signed-out version:
 * "Create Free Account" and an "Upgrade to PRO" link to sign-up. At hydration
 * the Clerk cookie hint switches a signed-in visitor to the account buttons,
 * and once `/api/auth/session` answers, `viewer.isPro` decides between
 * "Upgrade to PRO" and "Manage Billing". Until it answers the PRO button is
 * held, so a PRO user is never sent to checkout by a stale guess.
 */

export function FreePlanCta() {
  const { isSignedInHint } = useAppAuth()

  return (
    <Link
      href={isSignedInHint ? "/dashboard" : "/sign-up"}
      className={cn(buttonVariants({ variant: "outline", size: "lg" }), "w-full")}
    >
      {isSignedInHint ? "Go to Dashboard" : "Create Free Account"}
    </Link>
  )
}

export function ProPlanCta({ className }: { className?: string }) {
  const { isLoaded, isSignedInHint, viewer } = useAppAuth()

  return (
    <PricingCtaButton
      isSignedIn={isSignedInHint}
      isPro={viewer.isPro}
      pending={isSignedInHint && !isLoaded}
      className={className}
    />
  )
}
