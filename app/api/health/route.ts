import { NextResponse } from "next/server"

import { resolveModelProvider } from "@/app/lib/model-provider"
import prisma from "@/app/lib/prismadb"
import { isRedisAvailable, resolveRedisCredentials } from "@/app/lib/redis"

export async function GET(): Promise<NextResponse> {
  const timestamp = new Date().toISOString()

  try {
    await prisma.$queryRaw`SELECT 1`

    // Asked, not re-derived. This route had its own copy of the rule and read
    // only the `UPSTASH_*` pair, so when `getRedisClient` learned to accept the
    // Vercel KV credentials the platform already supplies, rate limiting started
    // working and this endpoint went on reporting `not_configured` — the health
    // check disagreeing with the thing whose health it reports.
    const { url, token } = resolveRedisCredentials()
    const redisConfigured = Boolean(url && token)
    const redisAvailable = redisConfigured ? await isRedisAvailable() : false
    const shouldRequireRedisInProd = process.env.NODE_ENV === "production"

    // Which service would answer a model call. Deliberately not a live call:
    // that costs money and latency on every uptime poll. It reports
    // *configuration*, which is not the same as *working* — production once
    // held an ANTHROPIC_API_KEY that returned 401 on every request, and this
    // line would have said "anthropic" throughout. `bun run model:check`
    // is the one that actually asks.
    const provider = resolveModelProvider()

    const status =
      (shouldRequireRedisInProd && (!redisConfigured || !redisAvailable)) ||
      provider.kind === "none"
        ? "degraded"
        : "ok"

    return NextResponse.json(
      {
        status,
        timestamp,
        database: "connected",
        redis: redisConfigured ? (redisAvailable ? "connected" : "disconnected") : "not_configured",
        model: provider.kind === "none" ? "not_configured" : provider.label,
      },
      { status: status === "ok" ? 200 : 503 }
    )
  } catch {
    return NextResponse.json(
      {
        status: "degraded",
        timestamp,
        database: "disconnected",
        error: "Database unreachable",
      },
      { status: 503 }
    )
  }
}
