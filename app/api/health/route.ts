import { NextResponse } from "next/server"

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

    const status =
      shouldRequireRedisInProd && (!redisConfigured || !redisAvailable) ? "degraded" : "ok"

    return NextResponse.json(
      {
        status,
        timestamp,
        database: "connected",
        redis: redisConfigured ? (redisAvailable ? "connected" : "disconnected") : "not_configured",
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
