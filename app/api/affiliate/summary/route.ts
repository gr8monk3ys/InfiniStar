import { NextResponse, type NextRequest } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { type Prisma } from "@prisma/client"
import { z } from "zod"

import { getAffiliatePartner, normalizeAffiliateSource } from "@/app/lib/monetization"
import prisma from "@/app/lib/prismadb"
import { apiLimiter, getClientIdentifier } from "@/app/lib/rate-limit"

const summaryQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(365).default(30),
  partnerId: z.string().trim().min(1).max(128).optional(),
  source: z.string().trim().min(1).max(128).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(10),
})

function parseAllowlist(rawValue: string | undefined): string[] {
  if (!rawValue) {
    return []
  }

  return rawValue
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter((email) => email.length > 0)
}

function parseQuery(searchParams: URLSearchParams) {
  return summaryQuerySchema.safeParse({
    days: searchParams.get("days") ?? undefined,
    partnerId: searchParams.get("partnerId") ?? undefined,
    source: searchParams.get("source") ?? undefined,
    limit: searchParams.get("limit") ?? undefined,
  })
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const identifier = getClientIdentifier(request)
  const allowed = await Promise.resolve(apiLimiter.check(identifier))

  if (!allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429 }
    )
  }

  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const currentUser = await prisma.user.findUnique({
    where: { clerkId: userId },
    select: { email: true },
  })

  if (!currentUser?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const allowlist = parseAllowlist(process.env.AFFILIATE_ANALYTICS_ALLOWED_EMAILS)
  if (allowlist.length === 0) {
    return NextResponse.json(
      {
        error:
          "Affiliate analytics access is not configured. Set AFFILIATE_ANALYTICS_ALLOWED_EMAILS.",
      },
      { status: 403 }
    )
  }

  if (!allowlist.includes(currentUser.email.toLowerCase())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const query = parseQuery(request.nextUrl.searchParams)
  if (!query.success) {
    return NextResponse.json(
      { error: query.error.issues[0]?.message ?? "Invalid query" },
      { status: 400 }
    )
  }

  const sourceFilter = query.data.source ? normalizeAffiliateSource(query.data.source) : undefined
  const windowStart = new Date(Date.now() - query.data.days * 24 * 60 * 60 * 1000)

  const where: Prisma.AffiliateClickWhereInput = {
    createdAt: { gte: windowStart },
  }

  if (query.data.partnerId) {
    where.partnerId = query.data.partnerId
  }

  if (sourceFilter) {
    where.source = sourceFilter
  }

  const [totalClicks, byPartnerRows, bySourceRows, destinationRows, clickEvents] =
    await Promise.all([
      prisma.affiliateClick.count({ where }),
      prisma.affiliateClick.groupBy({
        by: ["partnerId"],
        where,
        _count: { _all: true },
      }),
      prisma.affiliateClick.groupBy({
        by: ["source"],
        where,
        _count: { _all: true },
      }),
      prisma.affiliateClick.groupBy({
        by: ["destinationHost"],
        where,
        _count: { _all: true },
      }),
      prisma.affiliateClick.findMany({
        where,
        select: { createdAt: true },
        orderBy: { createdAt: "desc" },
        take: 10000,
      }),
    ])

  const byPartner = byPartnerRows
    .map((row) => ({
      partnerId: row.partnerId,
      partnerName: getAffiliatePartner(row.partnerId)?.name ?? row.partnerId,
      clicks: row._count._all,
    }))
    .sort((a, b) => b.clicks - a.clicks)
    .slice(0, query.data.limit)

  const bySource = bySourceRows
    .map((row) => ({
      source: row.source,
      clicks: row._count._all,
    }))
    .sort((a, b) => b.clicks - a.clicks)
    .slice(0, query.data.limit)

  const topDestinations = destinationRows
    .map((row) => ({
      destinationHost: row.destinationHost,
      clicks: row._count._all,
    }))
    .sort((a, b) => b.clicks - a.clicks)
    .slice(0, query.data.limit)

  const dailyClicksMap = clickEvents.reduce<Map<string, number>>((accumulator, event) => {
    const dateKey = event.createdAt.toISOString().slice(0, 10)
    accumulator.set(dateKey, (accumulator.get(dateKey) ?? 0) + 1)
    return accumulator
  }, new Map<string, number>())

  const dailyClicks = Array.from(dailyClicksMap.entries())
    .map(([date, clicks]) => ({
      date,
      clicks,
    }))
    .sort((a, b) => a.date.localeCompare(b.date))

  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    windowDays: query.data.days,
    windowStart: windowStart.toISOString(),
    filters: {
      partnerId: query.data.partnerId ?? null,
      source: sourceFilter ?? null,
    },
    totals: {
      clicks: totalClicks,
      uniquePartners: byPartnerRows.length,
      uniqueSources: bySourceRows.length,
      uniqueDestinations: destinationRows.length,
    },
    byPartner,
    bySource,
    topDestinations,
    dailyClicks,
  })
}
