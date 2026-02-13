import { redirect } from "next/navigation"
import { HiArrowTrendingUp, HiCurrencyDollar, HiHeart, HiSparkles } from "react-icons/hi2"

import { formatCurrencyFromCents, toMonthlyRecurringCents } from "@/app/lib/creator-monetization"
import prisma from "@/app/lib/prismadb"
import getCurrentUser from "@/app/actions/getCurrentUser"

export const metadata = {
  title: "Creator Earnings | InfiniStar",
  description: "Track creator support revenue, subscribers, and top supporters.",
}

export default async function CreatorEarningsPage() {
  const currentUser = await getCurrentUser()
  if (!currentUser?.id) {
    redirect("/sign-in")
  }

  const [tips, subscriptions, topSupporters] = await Promise.all([
    prisma.creatorTip.findMany({
      where: {
        creatorId: currentUser.id,
        status: "COMPLETED",
      },
      select: {
        amountCents: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 1000,
    }),
    prisma.creatorSubscription.findMany({
      where: {
        creatorId: currentUser.id,
      },
      select: {
        status: true,
        amountCents: true,
        interval: true,
      },
      take: 1000,
    }),
    prisma.creatorTip.findMany({
      where: {
        creatorId: currentUser.id,
        status: "COMPLETED",
      },
      select: {
        supporterId: true,
        amountCents: true,
        supporter: {
          select: {
            name: true,
            email: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 500,
    }),
  ])

  const tipsTotalCents = tips.reduce((sum, tip) => sum + tip.amountCents, 0)
  const now = Date.now()
  const tips30dCents = tips
    .filter((tip) => now - new Date(tip.createdAt).getTime() <= 30 * 24 * 60 * 60 * 1000)
    .reduce((sum, tip) => sum + tip.amountCents, 0)

  const activeSubscriptions = subscriptions.filter(
    (subscription) => subscription.status === "ACTIVE"
  )
  const activeSubscriberCount = activeSubscriptions.length
  const monthlyRecurringCents = activeSubscriptions.reduce(
    (sum, subscription) =>
      sum + toMonthlyRecurringCents(subscription.amountCents, subscription.interval),
    0
  )

  const supporterTotals = new Map<string, { label: string; total: number }>()
  topSupporters.forEach((tip) => {
    const key = tip.supporterId
    const existing = supporterTotals.get(key)
    const label = tip.supporter?.name || tip.supporter?.email || "Anonymous supporter"
    if (existing) {
      existing.total += tip.amountCents
      return
    }
    supporterTotals.set(key, {
      label,
      total: tip.amountCents,
    })
  })

  const topSupportersList = [...supporterTotals.values()]
    .sort((a, b) => b.total - a.total)
    .slice(0, 5)

  return (
    <div className="h-full lg:pl-80">
      <div className="flex h-full flex-col overflow-auto">
        <main className="flex-1 space-y-6 p-4 sm:p-6 lg:p-8">
          <header>
            <h1 className="text-2xl font-bold">Creator Earnings</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Track support from tips and recurring memberships.
            </p>
          </header>

          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <article className="rounded-xl border bg-card p-4">
              <div className="flex items-center gap-2 text-muted-foreground">
                <HiCurrencyDollar className="size-4" />
                <span className="text-xs uppercase tracking-wide">Lifetime Tips</span>
              </div>
              <p className="mt-2 text-xl font-semibold">
                {formatCurrencyFromCents(tipsTotalCents)}
              </p>
            </article>

            <article className="rounded-xl border bg-card p-4">
              <div className="flex items-center gap-2 text-muted-foreground">
                <HiArrowTrendingUp className="size-4" />
                <span className="text-xs uppercase tracking-wide">Tips (30d)</span>
              </div>
              <p className="mt-2 text-xl font-semibold">{formatCurrencyFromCents(tips30dCents)}</p>
            </article>

            <article className="rounded-xl border bg-card p-4">
              <div className="flex items-center gap-2 text-muted-foreground">
                <HiSparkles className="size-4" />
                <span className="text-xs uppercase tracking-wide">MRR</span>
              </div>
              <p className="mt-2 text-xl font-semibold">
                {formatCurrencyFromCents(monthlyRecurringCents)}
              </p>
            </article>

            <article className="rounded-xl border bg-card p-4">
              <div className="flex items-center gap-2 text-muted-foreground">
                <HiHeart className="size-4" />
                <span className="text-xs uppercase tracking-wide">Active Members</span>
              </div>
              <p className="mt-2 text-xl font-semibold">{activeSubscriberCount}</p>
            </article>
          </section>

          <section className="rounded-xl border bg-card p-5">
            <h2 className="text-lg font-semibold">Top Supporters</h2>
            {topSupportersList.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">No supporter data yet.</p>
            ) : (
              <div className="mt-3 space-y-2">
                {topSupportersList.map((supporter) => (
                  <div
                    key={supporter.label}
                    className="flex items-center justify-between rounded-lg border bg-muted/20 px-3 py-2 text-sm"
                  >
                    <span className="truncate pr-4">{supporter.label}</span>
                    <span className="font-medium">{formatCurrencyFromCents(supporter.total)}</span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </main>
      </div>
    </div>
  )
}
