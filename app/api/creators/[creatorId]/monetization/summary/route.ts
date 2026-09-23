import { NextResponse, type NextRequest } from "next/server"

import { toMonthlyRecurringCents } from "@/app/lib/creator-monetization"
import prisma from "@/app/lib/prismadb"
import getCurrentUser from "@/app/actions/getCurrentUser"

interface CreatorSupportSummary {
  tipCount: number
  tipsTotalCents: number
  activeSubscriberCount: number
  monthlyRecurringCents: number
  recentTipCount30d: number
}

function buildSummary(
  tips: Array<{ amountCents: number; createdAt: Date }>,
  activeSubscriptions: Array<{ amountCents: number; interval: "MONTHLY" | "YEARLY" }>
): CreatorSupportSummary {
  const now = Date.now()
  const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000

  const tipCount = tips.length
  const tipsTotalCents = tips.reduce((sum, tip) => sum + tip.amountCents, 0)
  const recentTipCount30d = tips.filter(
    (tip) => new Date(tip.createdAt).getTime() >= thirtyDaysAgo
  ).length

  const monthlyRecurringCents = activeSubscriptions.reduce(
    (sum, subscription) =>
      sum + toMonthlyRecurringCents(subscription.amountCents, subscription.interval),
    0
  )

  return {
    tipCount,
    tipsTotalCents,
    activeSubscriberCount: activeSubscriptions.length,
    monthlyRecurringCents,
    recentTipCount30d,
  }
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ creatorId: string }> }
) {
  const { creatorId } = await params

  // Every read here is keyed on the creator id from the path (the lookup below
  // is by primary key, so `creator.id === creatorId`), and the viewer's own
  // subscription chains off the viewer lookup. Nothing waits on anything it
  // does not need: one round trip instead of three.
  const [creator, tips, activeSubscriptions, viewerSubscription] = await Promise.all([
    prisma.user.findUnique({
      where: { id: creatorId },
      select: { id: true },
    }),
    prisma.creatorTip.findMany({
      where: {
        creatorId,
        status: "COMPLETED",
      },
      select: {
        amountCents: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
      take: 500,
    }),
    prisma.creatorSubscription.findMany({
      where: {
        creatorId,
        status: "ACTIVE",
      },
      select: {
        amountCents: true,
        interval: true,
      },
      take: 500,
    }),
    getCurrentUser().then((viewerUser) =>
      viewerUser?.id
        ? prisma.creatorSubscription.findUnique({
            where: {
              supporterId_creatorId: {
                supporterId: viewerUser.id,
                creatorId,
              },
            },
            select: {
              id: true,
              tierName: true,
              amountCents: true,
              interval: true,
              status: true,
            },
          })
        : null
    ),
  ])

  if (!creator) {
    return NextResponse.json({ error: "Creator not found" }, { status: 404 })
  }

  const summary = buildSummary(
    tips,
    activeSubscriptions as Array<{ amountCents: number; interval: "MONTHLY" | "YEARLY" }>
  )

  return NextResponse.json(
    {
      summary,
      viewerSubscription,
    },
    { status: 200 }
  )
}
