"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useAuth } from "@clerk/nextjs"
import toast from "react-hot-toast"
import { HiHeart, HiSparkles } from "react-icons/hi2"

import {
  CREATOR_SUBSCRIPTION_PLANS,
  CREATOR_TIP_AMOUNTS_CENTS,
  formatCurrencyFromCents,
} from "@/app/lib/creator-monetization"
import { Button } from "@/app/components/ui/button"
import { useCsrfToken, withCsrfHeader } from "@/app/hooks/useCsrfToken"

interface SupportSummary {
  tipCount: number
  tipsTotalCents: number
  activeSubscriberCount: number
  monthlyRecurringCents: number
  recentTipCount30d: number
}

interface ViewerSubscription {
  id: string
  tierName: string
  amountCents: number
  interval: "MONTHLY" | "YEARLY"
  status: "ACTIVE" | "CANCELED" | "PAUSED"
}

interface CreatorSupportCardProps {
  creatorId: string
  creatorName: string
  initialSummary: SupportSummary
  initialViewerSubscription: ViewerSubscription | null
}

export function CreatorSupportCard({
  creatorId,
  creatorName,
  initialSummary,
  initialViewerSubscription,
}: CreatorSupportCardProps) {
  const { isSignedIn } = useAuth()
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { token } = useCsrfToken()

  const [summary, setSummary] = useState(initialSummary)
  const [viewerSubscription, setViewerSubscription] = useState(initialViewerSubscription)
  const [isLoading, setIsLoading] = useState(false)

  const monthlyPlans = useMemo(
    () => CREATOR_SUBSCRIPTION_PLANS.filter((plan) => plan.interval === "MONTHLY"),
    []
  )

  const refreshSummary = useCallback(async () => {
    const response = await fetch(`/api/creators/${creatorId}/monetization/summary`)
    if (!response.ok) {
      return
    }
    const payload = (await response.json()) as {
      summary: SupportSummary
      viewerSubscription: ViewerSubscription | null
    }
    setSummary(payload.summary)
    setViewerSubscription(payload.viewerSubscription)
  }, [creatorId])

  async function handleTip(amountCents: number) {
    if (!isSignedIn) {
      toast.error("Sign in to support creators")
      return
    }
    if (!token) {
      toast.error("Security token unavailable. Refresh and try again.")
      return
    }

    setIsLoading(true)
    try {
      const response = await fetch(`/api/creators/${creatorId}/tips`, {
        method: "POST",
        headers: withCsrfHeader(token, {
          "Content-Type": "application/json",
        }),
        body: JSON.stringify({
          amountCents,
        }),
      })

      const payload = await response.json()
      if (!response.ok) {
        throw new Error(payload.error || "Unable to send tip")
      }

      if (payload.url && typeof payload.url === "string") {
        window.location.assign(payload.url)
        return
      }

      toast.success(`Queued ${formatCurrencyFromCents(amountCents)} tip`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to send tip")
    } finally {
      setIsLoading(false)
    }
  }

  async function handleSubscribe(plan: {
    tierName: string
    amountCents: number
    interval: "MONTHLY" | "YEARLY"
  }) {
    if (!isSignedIn) {
      toast.error("Sign in to subscribe")
      return
    }
    if (!token) {
      toast.error("Security token unavailable. Refresh and try again.")
      return
    }

    setIsLoading(true)
    try {
      const response = await fetch(`/api/creators/${creatorId}/subscription`, {
        method: "POST",
        headers: withCsrfHeader(token, {
          "Content-Type": "application/json",
        }),
        body: JSON.stringify({
          tierName: plan.tierName,
          amountCents: plan.amountCents,
          interval: plan.interval,
        }),
      })
      const payload = await response.json()
      if (!response.ok) {
        throw new Error(payload.error || "Unable to subscribe")
      }

      if (payload.url && typeof payload.url === "string") {
        window.location.assign(payload.url)
        return
      }

      toast.success(`Subscription started: ${plan.tierName}`)
      await refreshSummary()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to subscribe")
    } finally {
      setIsLoading(false)
    }
  }

  async function handleCancelSubscription() {
    if (!token) {
      toast.error("Security token unavailable. Refresh and try again.")
      return
    }

    setIsLoading(true)
    try {
      const response = await fetch(`/api/creators/${creatorId}/subscription`, {
        method: "DELETE",
        headers: withCsrfHeader(token, {
          "Content-Type": "application/json",
        }),
      })
      const payload = await response.json()
      if (!response.ok) {
        throw new Error(payload.error || "Unable to cancel subscription")
      }

      toast.success("Subscription canceled")
      await refreshSummary()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to cancel subscription")
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    const supportStatus = searchParams.get("support")
    if (!supportStatus) {
      return
    }

    if (supportStatus === "tip-success") {
      toast.success("Tip completed. Thanks for supporting this creator.")
      void refreshSummary()
    } else if (supportStatus === "subscription-success") {
      toast.success("Subscription activated.")
      void refreshSummary()
    } else if (supportStatus === "tip-canceled" || supportStatus === "subscription-canceled") {
      toast("Checkout canceled.")
    }

    const params = new URLSearchParams(searchParams.toString())
    params.delete("support")
    const nextQuery = params.toString()
    router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, { scroll: false })
  }, [pathname, refreshSummary, router, searchParams])

  return (
    <div className="rounded-xl border bg-card p-6 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        <HiHeart className="size-5 text-rose-500" />
        <h2 className="text-lg font-semibold">Support {creatorName}</h2>
      </div>
      <p className="text-sm text-muted-foreground">
        Help this creator keep building high-quality characters and story worlds.
      </p>

      <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
        <div className="rounded-lg border bg-muted/30 p-3">
          <p className="text-muted-foreground">Total tips</p>
          <p className="mt-1 text-sm font-semibold">
            {formatCurrencyFromCents(summary.tipsTotalCents)}
          </p>
        </div>
        <div className="rounded-lg border bg-muted/30 p-3">
          <p className="text-muted-foreground">Active supporters</p>
          <p className="mt-1 text-sm font-semibold">{summary.activeSubscriberCount}</p>
        </div>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Estimated recurring support: {formatCurrencyFromCents(summary.monthlyRecurringCents)} /
        month
      </p>

      <div className="mt-5">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Quick Tip
        </p>
        <div className="flex flex-wrap gap-2">
          {CREATOR_TIP_AMOUNTS_CENTS.map((amount) => (
            <Button
              key={amount}
              type="button"
              variant="outline"
              size="sm"
              disabled={isLoading}
              onClick={() => handleTip(amount)}
            >
              {formatCurrencyFromCents(amount)}
            </Button>
          ))}
        </div>
      </div>

      <div className="mt-5">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Monthly Membership
        </p>
        <div className="space-y-2">
          {monthlyPlans.map((plan) => (
            <Button
              key={plan.id}
              type="button"
              variant="secondary"
              size="sm"
              disabled={isLoading}
              onClick={() => handleSubscribe(plan)}
              className="w-full justify-between"
            >
              <span>{plan.tierName}</span>
              <span>{formatCurrencyFromCents(plan.amountCents)}/mo</span>
            </Button>
          ))}
        </div>
      </div>

      {viewerSubscription?.status === "ACTIVE" && (
        <div className="mt-5 rounded-lg border border-emerald-200 bg-emerald-50/60 p-3">
          <div className="flex items-center gap-2 text-sm font-medium text-emerald-700">
            <HiSparkles className="size-4" />
            Active Supporter
          </div>
          <p className="mt-1 text-xs text-emerald-700">
            {viewerSubscription.tierName}{" "}
            {viewerSubscription.interval === "MONTHLY" ? "monthly" : "yearly"} plan
          </p>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="mt-2 h-8 px-2 text-emerald-700 hover:bg-emerald-100 hover:text-emerald-800"
            onClick={handleCancelSubscription}
            disabled={isLoading}
          >
            Cancel Membership
          </Button>
        </div>
      )}
    </div>
  )
}
