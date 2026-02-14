#!/usr/bin/env node
import process from "node:process"
import { PrismaClient } from "@prisma/client"

function writeLine(message = "") {
  process.stdout.write(`${message}\n`)
}

function writeErrorLine(message = "") {
  process.stderr.write(`${message}\n`)
}

function parseArgs(argv) {
  const options = {}

  for (let index = 0; index < argv.length; index += 1) {
    const raw = argv[index]
    if (!raw.startsWith("--")) {
      continue
    }

    const withoutPrefix = raw.slice(2)
    const equalsIndex = withoutPrefix.indexOf("=")

    if (equalsIndex >= 0) {
      const key = withoutPrefix.slice(0, equalsIndex)
      const value = withoutPrefix.slice(equalsIndex + 1)
      options[key] = value
      continue
    }

    const key = withoutPrefix
    const next = argv[index + 1]
    if (next && !next.startsWith("--")) {
      options[key] = next
      index += 1
      continue
    }

    options[key] = "true"
  }

  return options
}

function parsePositiveInt(rawValue, fallback) {
  if (rawValue === undefined || rawValue === null || rawValue === "") {
    return fallback
  }

  const parsed = Number(rawValue)
  if (!Number.isFinite(parsed) || parsed <= 0 || !Number.isInteger(parsed)) {
    return fallback
  }

  return parsed
}

function centsToUsd(cents) {
  if (!Number.isFinite(cents)) {
    return 0
  }
  return Math.round((cents / 100) * 100) / 100
}

function formatUsd(value) {
  const rounded = Math.round(value * 100) / 100
  return `$${rounded.toFixed(2)}`
}

function isProUser(user) {
  return Boolean(
    user.stripePriceId &&
    user.stripeCurrentPeriodEnd &&
    user.stripeCurrentPeriodEnd.getTime() + 86_400_000 > Date.now()
  )
}

const argv = parseArgs(process.argv.slice(2))

const days = parsePositiveInt(argv.days || process.env.UNIT_ECON_DAYS, 30)
const topUsers = parsePositiveInt(argv["top-users"] || process.env.UNIT_ECON_TOP_USERS, 10)
const proPriceUsd = Number(argv["pro-price-usd"] || process.env.UNIT_ECON_PRO_PRICE_USD || 20)

const stripePct = Number(argv["stripe-pct"] || process.env.UNIT_ECON_STRIPE_PCT || 0.029)
const stripeFixedUsd = Number(
  argv["stripe-fixed-usd"] || process.env.UNIT_ECON_STRIPE_FIXED_USD || 0.3
)

if (!process.env.DATABASE_URL) {
  writeErrorLine("Missing DATABASE_URL. Set it in the environment and re-run.")
  process.exit(1)
}

const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
const prisma = new PrismaClient()

try {
  const where = { createdAt: { gte: since } }

  const [totals, byRequestType, byModel, byUser] = await Promise.all([
    prisma.aiUsage.aggregate({
      where,
      _count: { _all: true },
      _sum: {
        totalTokens: true,
        inputTokens: true,
        outputTokens: true,
        totalCost: true,
      },
    }),
    prisma.aiUsage.groupBy({
      by: ["requestType"],
      where,
      _count: { _all: true },
      _sum: { totalTokens: true, totalCost: true },
      orderBy: { _sum: { totalCost: "desc" } },
    }),
    prisma.aiUsage.groupBy({
      by: ["model"],
      where,
      _count: { _all: true },
      _sum: { totalTokens: true, totalCost: true },
      orderBy: { _sum: { totalCost: "desc" } },
    }),
    prisma.aiUsage.groupBy({
      by: ["userId"],
      where,
      _count: { _all: true },
      _sum: { totalTokens: true, totalCost: true },
      orderBy: { _sum: { totalCost: "desc" } },
      take: topUsers,
    }),
  ])

  const totalRequests = totals._count._all
  const totalTokens = totals._sum.totalTokens ?? 0
  const totalCostCents = totals._sum.totalCost ?? 0
  const totalCostUsd = centsToUsd(totalCostCents)

  // Pro vs free segmentation (for the top spenders only, to keep it lightweight)
  const userIds = byUser.map((row) => row.userId)
  const users = userIds.length
    ? await prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, stripePriceId: true, stripeCurrentPeriodEnd: true },
      })
    : []

  const userById = new Map(users.map((user) => [user.id, user]))
  let proTopUsersCount = 0
  let proTopUsersCostCents = 0
  let freeTopUsersCostCents = 0

  for (const row of byUser) {
    const user = userById.get(row.userId)
    const costCents = row._sum.totalCost ?? 0
    if (user && isProUser(user)) {
      proTopUsersCount += 1
      proTopUsersCostCents += costCents
    } else {
      freeTopUsersCostCents += costCents
    }
  }

  // Very rough MRR estimate (only counts the top spenders we fetched)
  const proTopUsersRevenueUsd = proTopUsersCount * proPriceUsd
  const proTopUsersStripeFeesUsd =
    proTopUsersCount > 0 ? proTopUsersRevenueUsd * stripePct + proTopUsersCount * stripeFixedUsd : 0
  const proTopUsersNetRevenueUsd = Math.max(0, proTopUsersRevenueUsd - proTopUsersStripeFeesUsd)
  const proTopUsersCostUsd = centsToUsd(proTopUsersCostCents)
  const proTopUsersGrossProfitUsd = proTopUsersNetRevenueUsd - proTopUsersCostUsd

  writeLine("AI unit economics (usage + cost)")
  writeLine(`Range: last ${days} days (since ${since.toISOString()})`)
  writeLine(`Total requests: ${totalRequests}`)
  writeLine(`Total tokens: ${totalTokens.toLocaleString()}`)
  writeLine(`Estimated LLM cost: ${formatUsd(totalCostUsd)}`)

  writeLine()
  writeLine("By requestType (sorted by cost)")
  for (const row of byRequestType) {
    const requests = row._count._all
    const tokens = row._sum.totalTokens ?? 0
    const cost = centsToUsd(row._sum.totalCost ?? 0)
    const avgCost = requests > 0 ? cost / requests : 0
    writeLine(
      `- ${row.requestType}: ${requests} req, ${tokens.toLocaleString()} tok, ${formatUsd(
        cost
      )} total (${formatUsd(avgCost)} avg)`
    )
  }

  writeLine()
  writeLine("By model (sorted by cost)")
  for (const row of byModel) {
    const requests = row._count._all
    const tokens = row._sum.totalTokens ?? 0
    const cost = centsToUsd(row._sum.totalCost ?? 0)
    const avgCost = requests > 0 ? cost / requests : 0
    writeLine(
      `- ${row.model}: ${requests} req, ${tokens.toLocaleString()} tok, ${formatUsd(
        cost
      )} total (${formatUsd(avgCost)} avg)`
    )
  }

  if (byUser.length > 0) {
    writeLine()
    writeLine(`Top ${byUser.length} users by LLM cost (no PII)`)
    for (const row of byUser) {
      const cost = centsToUsd(row._sum.totalCost ?? 0)
      const tokens = row._sum.totalTokens ?? 0
      const isPro = Boolean(userById.get(row.userId) && isProUser(userById.get(row.userId)))
      writeLine(
        `- ${row.userId.slice(0, 8)}…: ${formatUsd(cost)} (${tokens.toLocaleString()} tok) [${
          isPro ? "PRO" : "FREE"
        }]`
      )
    }
  }

  writeLine()
  writeLine("Rough PRO margin estimate (only for top users fetched)")
  writeLine(`Assumed PRO price: ${formatUsd(proPriceUsd)} / month`)
  writeLine(`Assumed Stripe fees: ${(stripePct * 100).toFixed(2)}% + ${formatUsd(stripeFixedUsd)}`)
  writeLine(`PRO users counted: ${proTopUsersCount}`)
  writeLine(`PRO gross revenue: ${formatUsd(proTopUsersRevenueUsd)}`)
  writeLine(`PRO Stripe fees: ${formatUsd(proTopUsersStripeFeesUsd)}`)
  writeLine(`PRO net revenue: ${formatUsd(proTopUsersNetRevenueUsd)}`)
  writeLine(`PRO LLM cost: ${formatUsd(proTopUsersCostUsd)}`)
  writeLine(`PRO gross profit (LLM only): ${formatUsd(proTopUsersGrossProfitUsd)}`)
  writeLine(`FREE LLM cost (top users only): ${formatUsd(centsToUsd(freeTopUsersCostCents))}`)

  writeLine()
  writeLine(
    "Note: This script estimates LLM cost only (no infra, email, storage, ads, support, taxes)."
  )
} finally {
  await prisma.$disconnect()
}
