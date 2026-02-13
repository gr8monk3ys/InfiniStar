import { NextResponse, type NextRequest } from "next/server"
import { auth } from "@clerk/nextjs/server"

import { toMonthlyRecurringCents } from "@/app/lib/creator-monetization"
import prisma from "@/app/lib/prismadb"

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
  const creator = await prisma.user.findUnique({
    where: { id: creatorId },
    select: { id: true },
  })
  if (!creator) {
    return NextResponse.json({ error: "Creator not found" }, { status: 404 })
  }

  const [tips, activeSubscriptions, authResult] = await Promise.all([
    prisma.creatorTip.findMany({
      where: {
        creatorId: creator.id,
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
        creatorId: creator.id,
        status: "ACTIVE",
      },
      select: {
        amountCents: true,
        interval: true,
      },
      take: 500,
    }),
    auth(),
  ])

  const summary = buildSummary(
    tips,
    activeSubscriptions as Array<{ amountCents: number; interval: "MONTHLY" | "YEARLY" }>
  )

  const viewerUserId = authResult.userId
    ? await prisma.user.findUnique({
        where: { clerkId: authResult.userId },
        select: { id: true },
      })
    : null

  const viewerSubscription = viewerUserId?.id
    ? await prisma.creatorSubscription.findUnique({
        where: {
          supporterId_creatorId: {
            supporterId: viewerUserId.id,
            creatorId: creator.id,
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

  return NextResponse.json(
    {
      summary,
      viewerSubscription,
    },
    { status: 200 }
  )
}
